import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { getDashboard, getHealth, submitSetupRequest } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const envPath = path.join(rootDir, ".env");

loadEnvFile(envPath);

const port = Number(process.env.PORT || 4020);

const sessionStore = new Map();
const rateLimitStore = new Map();

const generatedPassword = crypto.randomBytes(12).toString("base64url");
const authConfig = {
  username: process.env.AUTH_USERNAME || "admin",
  password: process.env.AUTH_PASSWORD || generatedPassword,
  sessionSecret: process.env.AUTH_SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
  secureCookies: process.env.NODE_ENV === "production",
  sessionTtlMs: 1000 * 60 * 60 * 8
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const securityHeaders = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data:; " +
    "connect-src 'self'; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'none'"
};

const loginPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Outbound Forge Login</title>
  <style>
    :root { color-scheme: dark; --bg:#08101a; --panel:rgba(14,20,35,.92); --border:rgba(152,182,255,.14); --text:#f3f7fc; --muted:#9baac4; --accent:#8ee3c4; }
    * { box-sizing:border-box; } body { margin:0; min-height:100vh; display:grid; place-items:center; font-family:Manrope,Arial,sans-serif; color:var(--text); background:radial-gradient(circle at top left, rgba(140,168,255,.16), transparent 28%), radial-gradient(circle at 90% 15%, rgba(142,227,196,.12), transparent 24%), linear-gradient(180deg, #08101a 0%, #050910 100%); }
    .card { width:min(460px, calc(100% - 24px)); padding:24px; border-radius:24px; border:1px solid var(--border); background:var(--panel); box-shadow:0 28px 80px rgba(0,0,0,.34); }
    h1,p { margin:0; } h1 { font-size:2rem; margin-bottom:10px; } p { color:var(--muted); margin-bottom:18px; line-height:1.6; }
    form { display:grid; gap:14px; } label { display:grid; gap:8px; color:var(--text); font-weight:600; } input { width:100%; padding:13px 14px; border-radius:14px; border:1px solid var(--border); background:#09111d; color:var(--text); font:inherit; }
    button { border:0; border-radius:999px; padding:13px 18px; font:inherit; font-weight:700; cursor:pointer; color:#08101a; background:linear-gradient(135deg, var(--accent), #cbffe9); }
    .error { min-height:24px; color:#ff8c88; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Protected Workspace</h1>
    <p>Sign in to access the Outbound Forge dashboard and API.</p>
    <form id="login-form">
      <label>Username<input name="username" autocomplete="username" required></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit">Sign in</button>
      <div class="error" id="login-error"></div>
    </form>
  </main>
  <script>
    const form = document.getElementById("login-form");
    const errorNode = document.getElementById("login-error");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      errorNode.textContent = "";
      const formData = new FormData(form);
      const payload = { username: formData.get("username"), password: formData.get("password") };
      const response = await fetch("/api/auth/login", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { errorNode.textContent = data.error || "Login failed"; return; }
      window.location.href = "/";
    });
  </script>
</body>
</html>`;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function now() {
  return Date.now();
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function cleanExpiredSessions() {
  const timestamp = now();
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt <= timestamp) {
      sessionStore.delete(token);
    }
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) {
    return {};
  }
  return header.split(";").reduce((cookies, chunk) => {
    const [rawKey, ...rawValue] = chunk.trim().split("=");
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function createSession(username, ip) {
  const token = crypto.randomBytes(32).toString("base64url");
  const signature = crypto.createHmac("sha256", authConfig.sessionSecret).update(token).digest("base64url");
  sessionStore.set(token, { username, ip, expiresAt: now() + authConfig.sessionTtlMs });
  return `${token}.${signature}`;
}

function getSessionFromRequest(req) {
  cleanExpiredSessions();
  const cookies = parseCookies(req);
  const rawToken = cookies.outbound_forge_session;
  if (!rawToken || !rawToken.includes(".")) {
    return null;
  }

  const [token, signature] = rawToken.split(".");
  const expected = crypto.createHmac("sha256", authConfig.sessionSecret).update(token).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature || "");
  if (expectedBuffer.length !== providedBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return null;
  }

  const session = sessionStore.get(token);
  if (!session || session.expiresAt <= now()) {
    sessionStore.delete(token);
    return null;
  }
  return { token, ...session };
}

function getRateLimitRecord(key, windowMs) {
  const timestamp = now();
  const record = rateLimitStore.get(key);
  if (!record || record.expiresAt <= timestamp) {
    const nextRecord = { count: 0, expiresAt: timestamp + windowMs };
    rateLimitStore.set(key, nextRecord);
    return nextRecord;
  }
  return record;
}

function isRateLimited(key, limit, windowMs) {
  const record = getRateLimitRecord(key, windowMs);
  record.count += 1;
  return record.count > limit;
}

function baseHeaders(extra = {}) {
  return { ...securityHeaders, ...extra };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, baseHeaders({ "Content-Type": "application/json; charset=utf-8", ...extraHeaders }));
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html, extraHeaders = {}) {
  res.writeHead(statusCode, baseHeaders({ "Content-Type": "text/html; charset=utf-8", ...extraHeaders }));
  res.end(html);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mimeTypes[ext] || "application/octet-stream";
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { ok: false, error: "File not found" });
      return;
    }
    res.writeHead(200, baseHeaders({ "Content-Type": type }));
    res.end(content);
  });
}

function collectJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function validateSetupPayload(payload) {
  const requiredFields = ["ownerName", "companyName", "email", "teamType", "platform", "contactsPerMonth", "sendingDays", "dailyPerMailbox", "mailboxesPerDomain"];
  return requiredFields.filter(field => {
    const value = payload[field];
    return value === undefined || value === null || value === "";
  });
}

function resolveStaticPath(urlPath) {
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
  const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  return path.join(rootDir, normalizedPath);
}

function sessionCookieValue(token) {
  const parts = [
    `outbound_forge_session=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${Math.floor(authConfig.sessionTtlMs / 1000)}`
  ];
  if (authConfig.secureCookies) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function clearSessionCookie() {
  const parts = ["outbound_forge_session=", "HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=0"];
  if (authConfig.secureCookies) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = requestUrl;
  const clientIp = getClientIp(req);

  if (isRateLimited(`global:${clientIp}`, 300, 5 * 60 * 1000)) {
    sendJson(res, 429, { ok: false, error: "Too many requests" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, baseHeaders({
      "Access-Control-Allow-Origin": "self",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
    }));
    res.end();
    return;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, getHealth());
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    if (isRateLimited(`login:${clientIp}`, 10, 15 * 60 * 1000)) {
      sendJson(res, 429, { ok: false, error: "Too many login attempts" });
      return;
    }

    try {
      const payload = await collectJsonBody(req);
      const usernameOk = payload.username === authConfig.username;
      const providedPassword = String(payload.password || "");
      const expectedPassword = String(authConfig.password);
      const passwordOk =
        providedPassword.length === expectedPassword.length &&
        crypto.timingSafeEqual(Buffer.from(providedPassword), Buffer.from(expectedPassword));

      if (!usernameOk || !passwordOk) {
        sendJson(res, 401, { ok: false, error: "Invalid credentials" });
        return;
      }

      const sessionToken = createSession(payload.username, clientIp);
      sendJson(res, 200, { ok: true, username: payload.username }, { "Set-Cookie": sessionCookieValue(sessionToken) });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    const session = getSessionFromRequest(req);
    if (session) {
      sessionStore.delete(session.token);
    }
    sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
    return;
  }

  if (req.method === "GET" && pathname === "/api/auth/session") {
    const session = getSessionFromRequest(req);
    if (!session) {
      sendJson(res, 401, { ok: false, authenticated: false });
      return;
    }
    sendJson(res, 200, { ok: true, authenticated: true, username: session.username });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session && pathname.startsWith("/api/")) {
    sendJson(res, 401, { ok: false, error: "Authentication required" });
    return;
  }

  if (req.method === "GET" && pathname === "/api/dashboard") {
    sendJson(res, 200, getDashboard());
    return;
  }

  if (req.method === "POST" && pathname === "/api/setup-request") {
    try {
      const payload = await collectJsonBody(req);
      const missing = validateSetupPayload(payload);
      if (missing.length > 0) {
        sendJson(res, 400, { ok: false, error: `Missing required fields: ${missing.join(", ")}` });
        return;
      }
      const result = submitSetupRequest(payload);
      sendJson(res, 201, { ok: true, ...result });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === "GET") {
    if (!session) {
      sendHtml(res, 200, loginPage);
      return;
    }

    const staticPath = resolveStaticPath(pathname);
    if (fs.existsSync(staticPath) && fs.statSync(staticPath).isFile()) {
      sendFile(res, staticPath);
      return;
    }

    sendFile(res, path.join(rootDir, "index.html"));
    return;
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed" });
});

server.listen(port, () => {
  console.log(`Outbound Forge server listening on http://localhost:${port}`);
  console.log(`Username: ${authConfig.username}`);
  if (!process.env.AUTH_PASSWORD) {
    console.log(`Generated password: ${generatedPassword}`);
    console.log("Set AUTH_PASSWORD and AUTH_SESSION_SECRET to replace temporary local credentials.");
  }
});
