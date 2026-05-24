const test = require("node:test");
const assert = require("node:assert/strict");
const { LoginRateLimiter, SessionManager, safeEqual, securityHeaders } = require("../lib/security");

test("compares credentials without plain equality", () => {
  assert.equal(safeEqual("school-admin", "school-admin"), true);
  assert.equal(safeEqual("school-admin", "teacher"), false);
});

test("expires sessions after their configured lifetime", async () => {
  const sessions = new SessionManager(1);
  const session = sessions.create({ role: "School Admin" });
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(sessions.read(session.token), null);
});

test("limits repeated failed sign-in attempts", () => {
  const limiter = new LoginRateLimiter({ maximumAttempts: 2, windowMilliseconds: 1000 });
  limiter.failure("client");
  assert.equal(limiter.status("client").blocked, false);
  limiter.failure("client");
  assert.equal(limiter.status("client").blocked, true);
  limiter.success("client");
  assert.equal(limiter.status("client").blocked, false);
});

test("applies strict browser security headers", () => {
  const headers = securityHeaders(true);

  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.match(headers["Strict-Transport-Security"], /max-age=/);
});
