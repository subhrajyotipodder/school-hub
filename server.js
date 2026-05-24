const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Store } = require("./lib/store");
const { PgStore } = require("./lib/pg-store");
const { LoginRateLimiter, SessionManager, logSecurityEvent, safeEqual, securityHeaders } = require("./lib/security");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const AUTH_MODE = process.env.AUTH_MODE || "local";
const DATA_BACKEND = process.env.DATA_BACKEND || "json";
const PUBLIC_DIR = path.join(__dirname, "public");
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data", "db.json");
const SESSION_TTL_MINUTES = Number(process.env.SESSION_TTL_MINUTES || 60);
const sessions = new SessionManager(SESSION_TTL_MINUTES * 60 * 1000);
const loginLimiter = new LoginRateLimiter({ maximumAttempts: 5, windowMilliseconds: 15 * 60 * 1000 });
const ADMIN_USER = {
  email: process.env.ADMIN_EMAIL || "admin@brightfuture.edu",
  password: process.env.ADMIN_PASSWORD || "Admin@123",
  name: "Administrator",
  role: "School Admin"
};

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

function validateStartupConfiguration() {
  if (IS_PRODUCTION && AUTH_MODE === "local") {
    throw new Error("Production startup blocked: configure Microsoft Entra authentication instead of AUTH_MODE=local.");
  }
  if (IS_PRODUCTION && DATA_BACKEND === "json") {
    throw new Error("Production startup blocked: local JSON storage is not approved for student data. Configure PostgreSQL.");
  }
  if (IS_PRODUCTION && ADMIN_USER.password === "Admin@123") {
    throw new Error("Production startup blocked: demo administrator credentials are enabled.");
  }
}

// Select store based on DATA_BACKEND env variable
const store = DATA_BACKEND === "postgres" ? new PgStore() : new Store(DB_FILE);

function writeHead(res, status, headers = {}) {
  res.writeHead(status, { ...securityHeaders(IS_PRODUCTION), ...headers });
}

function json(res, status, body, headers = {}) {
  writeHead(res, status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let content = "";
    req.on("data", (chunk) => {
      content += chunk;
      if (content.length > 1_000_000) reject(new Error("Request too large."));
    });
    req.on("end", () => {
      try {
        resolve(content ? JSON.parse(content) : {});
      } catch {
        const error = new Error("Invalid JSON body.");
        error.status = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/health" || pathname === "/health") return json(res, 200, { status: "ok" });
  if (pathname === "/api/auth/login" && req.method === "POST") {
    if (AUTH_MODE !== "local") return json(res, 501, { error: "This sign-in method is not enabled." });
    const clientAddress = req.socket.remoteAddress || "unknown";
    const rateLimit = loginLimiter.status(clientAddress);
    if (rateLimit.blocked) {
      logSecurityEvent("login_rate_limited", { clientAddress });
      return json(res, 429, { error: "Too many sign-in attempts. Please try again later." }, {
        "Retry-After": String(rateLimit.retryAfterSeconds)
      });
    }
    const credentials = await readBody(req);
    if (!safeEqual(credentials.email, ADMIN_USER.email) || !safeEqual(credentials.password, ADMIN_USER.password)) {
      loginLimiter.failure(clientAddress);
      logSecurityEvent("login_failed", { clientAddress });
      return json(res, 401, { error: "Invalid email address or password." });
    }
    loginLimiter.success(clientAddress);
    const session = sessions.create({ name: ADMIN_USER.name, role: ADMIN_USER.role });
    logSecurityEvent("login_succeeded", { clientAddress, role: ADMIN_USER.role });
    return json(res, 200, session);
  }
  const token = readToken(req);
  const session = sessions.read(token);
  const user = session ? session.user : null;
  if (pathname === "/api/auth/session" && req.method === "GET") {
    return user ? json(res, 200, { user }) : json(res, 401, { error: "Please sign in to continue." });
  }
  if (pathname === "/api/auth/logout" && req.method === "POST") {
    sessions.remove(token);
    logSecurityEvent("logout", { role: user?.role || "unknown" });
    return json(res, 204, {});
  }
  if (!user) return json(res, 401, { error: "Please sign in to continue." });
  if (pathname === "/api/bootstrap" && req.method === "GET") return json(res, 200, await store.getBootstrap());

  const match = pathname.match(/^\/api\/([a-z]+)(?:\/([^/]+))?$/);
  if (!match) return json(res, 404, { error: "Endpoint not found." });
  const [, collection, id] = match;

  if (req.method === "GET" && !id) return json(res, 200, await store.list(collection));
  if (req.method === "POST" && !id) return json(res, 201, await store.create(collection, await readBody(req)));
  if (req.method === "PATCH" && id) {
    const updated = await store.update(collection, id, await readBody(req));
    return updated ? json(res, 200, updated) : json(res, 404, { error: "Record not found." });
  }
  if (req.method === "DELETE" && id) {
    return (await store.remove(collection, id)) ? json(res, 204, {}) : json(res, 404, { error: "Record not found." });
  }
  return json(res, 405, { error: "Method not allowed." });
}

function readToken(req) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function serveStatic(res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return json(res, 403, { error: "Forbidden." });
  fs.readFile(filePath, (error, file) => {
    if (error) {
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallbackError, html) => {
        if (fallbackError) return json(res, 404, { error: "Not found." });
        writeHead(res, 200, { "Cache-Control": "no-store", "Content-Type": mimeTypes[".html"] });
        res.end(html);
      });
      return;
    }
    writeHead(res, 200, {
      "Cache-Control": path.extname(filePath) === ".html" ? "no-store" : "public, max-age=3600",
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream"
    });
    res.end(file);
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  try {
    if (pathname.startsWith("/api/") || pathname === "/health") return await handleApi(req, res, pathname);
    serveStatic(res, pathname);
  } catch (error) {
    json(res, error.status || 500, { error: error.status ? error.message : "Internal server error." });
  }
});

if (require.main === module) {
  validateStartupConfiguration();
  server.listen(PORT, HOST, () => {
    console.log(`School Hub is running at http://${HOST}:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    server.close();
    if (store.close) await store.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

module.exports = { server };
