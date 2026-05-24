const crypto = require("node:crypto");

function safeEqual(left, right) {
  const first = Buffer.from(String(left || ""));
  const second = Buffer.from(String(right || ""));
  if (first.length !== second.length) return false;
  return crypto.timingSafeEqual(first, second);
}

class SessionManager {
  constructor(ttlMilliseconds) {
    this.ttlMilliseconds = ttlMilliseconds;
    this.sessions = new Map();
  }

  create(user) {
    const token = crypto.randomBytes(32).toString("hex");
    const session = {
      user,
      expiresAt: Date.now() + this.ttlMilliseconds
    };
    this.sessions.set(token, session);
    return { token, expiresAt: new Date(session.expiresAt).toISOString(), user };
  }

  read(token) {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return session;
  }

  remove(token) {
    if (token) this.sessions.delete(token);
  }
}

class LoginRateLimiter {
  constructor({ maximumAttempts, windowMilliseconds }) {
    this.maximumAttempts = maximumAttempts;
    this.windowMilliseconds = windowMilliseconds;
    this.attempts = new Map();
  }

  status(key) {
    const current = this.attempts.get(key);
    if (!current || current.resetsAt <= Date.now()) {
      this.attempts.delete(key);
      return { blocked: false, retryAfterSeconds: 0 };
    }
    return {
      blocked: current.count >= this.maximumAttempts,
      retryAfterSeconds: Math.ceil((current.resetsAt - Date.now()) / 1000)
    };
  }

  failure(key) {
    const current = this.attempts.get(key);
    if (!current || current.resetsAt <= Date.now()) {
      this.attempts.set(key, { count: 1, resetsAt: Date.now() + this.windowMilliseconds });
      return;
    }
    current.count += 1;
  }

  success(key) {
    this.attempts.delete(key);
  }
}

function securityHeaders(isProduction) {
  const headers = {
    "Content-Security-Policy": "default-src 'self'; base-uri 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  };
  if (isProduction) headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  return headers;
}

function logSecurityEvent(event, details = {}) {
  console.info(JSON.stringify({
    category: "security",
    event,
    timestamp: new Date().toISOString(),
    ...details
  }));
}

module.exports = { LoginRateLimiter, SessionManager, logSecurityEvent, safeEqual, securityHeaders };
