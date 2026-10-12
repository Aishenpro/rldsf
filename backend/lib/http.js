"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const cfg = require("../../config/config");

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8" };
const COMPRESSIBLE = /^(text\/|application\/(json|xml)|image\/svg)/;

// ---------- logging ----------
const logDir = path.join(cfg.ROOT, "logs");
function log(level, msg, extra) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...extra });
  if (level === "error" || !cfg.prod) console.error(line); else console.log(line);
  try { fs.mkdirSync(logDir, { recursive: true }); fs.appendFile(path.join(logDir, "app.log"), line + "\n", () => {}); } catch (_) {}
}

// ---------- request context ----------
function clientIp(req) {
  if (cfg.trustProxy) { const x = req.headers["x-forwarded-for"]; if (x) return String(x).split(",")[0].trim(); }
  return req.socket.remoteAddress || "unknown";
}
function parseCookies(h) {
  const out = {};
  for (const p of String(h || "").split(";")) { const i = p.indexOf("="); if (i > 0) { try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (_) {} } }
  return out;
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error("Request too large"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function parseMultipart(buf, boundary) {
  const fields = {}, files = {}, b = Buffer.from("--" + boundary);
  let pos = buf.indexOf(b);
  while (pos !== -1) {
    const next = buf.indexOf(b, pos + b.length);
    if (next === -1) break;
    const part = buf.subarray(pos + b.length + 2, next - 2);
    const sep = part.indexOf("\r\n\r\n");
    if (sep > -1) {
      const head = part.subarray(0, sep).toString("utf8"), body = part.subarray(sep + 4);
      const m = /name="([^"]*)"(?:;\s*filename="([^"]*)")?/i.exec(head);
      if (m) {
        if (m[2] !== undefined) { if (m[2] && body.length) files[m[1]] = { filename: m[2], data: body }; }
        else fields[m[1]] = body.toString("utf8");
      }
    }
    pos = next;
  }
  return { fields, files };
}
async function parseRequest(req, { limit = 100 * 1024, raw = false } = {}) {
  const ct = String(req.headers["content-type"] || "");
  const len = Number(req.headers["content-length"] || 0);
  const isMulti = ct.startsWith("multipart/form-data");
  const max = isMulti ? 12 * 1024 * 1024 : limit;
  if (len > max) throw Object.assign(new Error("Request too large"), { status: 413 });
  const buf = await readBody(req, max);
  if (raw) return { rawBody: buf, body: {}, files: {} };
  if (isMulti) {
    const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
    if (!bm) throw Object.assign(new Error("Bad multipart"), { status: 400 });
    const { fields, files } = parseMultipart(buf, bm[1] || bm[2]);
    return { body: fields, files };
  }
  if (ct.startsWith("application/json")) { try { return { body: JSON.parse(buf.toString() || "{}"), files: {} }; } catch { throw Object.assign(new Error("Bad JSON"), { status: 400 }); } }
  const body = {};
  for (const [k, v] of new URLSearchParams(buf.toString())) body[k] = v;
  return { body, files: {} };
}

// ---------- responses ----------
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; form-action 'self' https://checkout.stripe.com https://www.paypal.com https://www.sandbox.paypal.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
};
function send(ctx, status, body, type = "text/html; charset=utf-8", headers = {}) {
  const { req, res } = ctx;
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const h = { ...SECURITY_HEADERS, "Content-Type": type, ...headers };
  if (cfg.prod) h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  if (ctx.setCookies.length) h["Set-Cookie"] = ctx.setCookies;
  let out = buf;
  if (COMPRESSIBLE.test(type) && buf.length > 1024 && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
    out = zlib.gzipSync(buf); h["Content-Encoding"] = "gzip"; h["Vary"] = "Accept-Encoding";
  }
  h["Content-Length"] = out.length;
  res.writeHead(status, h);
  res.end(req.method === "HEAD" ? undefined : out);
}
const sendHtml = (ctx, page, status = 200) => send(ctx, status, page.s ?? page, "text/html; charset=utf-8", { "Cache-Control": "no-store" });
const sendJson = (ctx, obj, status = 200) => send(ctx, status, JSON.stringify(obj), "application/json", { "Cache-Control": "no-store" });
const redirect = (ctx, to, status = 303) => send(ctx, status, "", "text/plain", { Location: to, "Cache-Control": "no-store" });
function setCookie(ctx, name, value, opts = {}) {
  const p = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", `SameSite=${opts.sameSite || "Lax"}`];
  if (cfg.prod) p.push("Secure");
  if (opts.maxAge !== undefined) p.push(`Max-Age=${opts.maxAge}`);
  ctx.setCookies.push(p.join("; "));
}

// ---------- static files ----------
function serveFile(ctx, root, rel, { immutable = false } = {}) {
  let p;
  try { p = path.normalize(path.join(root, decodeURIComponent(rel))); } catch { return false; }
  if (!p.startsWith(root + path.sep) || path.basename(p).startsWith(".")) return false;
  let st; try { st = fs.statSync(p); } catch { return false; }
  if (!st.isFile()) return false;
  const ext = path.extname(p).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const etag = `"${st.size}-${Math.floor(st.mtimeMs)}"`;
  const headers = { ETag: etag, "Last-Modified": st.mtime.toUTCString(),
    "Cache-Control": immutable ? "public, max-age=2592000" : "public, max-age=3600" };
  if (ext === ".pdf") headers["Content-Disposition"] = "inline";
  if (ctx.req.headers["if-none-match"] === etag) { send(ctx, 304, "", type, headers); return true; }
  send(ctx, 200, fs.readFileSync(p), type, headers);
  return true;
}

// ---------- rate limiting (in-memory sliding window) ----------
const buckets = new Map();
function rateLimit(ctx, name, max, windowMs) {
  const key = name + ":" + ctx.ip, now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { buckets.set(key, arr); return false; }
  arr.push(now); buckets.set(key, arr);
  return true;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of buckets) if (!v.some((t) => now - t < 3600e3)) buckets.delete(k); }, 600e3).unref();

// ---------- CSRF (public forms: cookie + HMAC field; admin: per-session token) ----------
const hmac = (v) => crypto.createHmac("sha256", cfg.secret).update(v).digest("hex");
function publicCsrf(ctx) {
  let c = ctx.cookies.rl_csrf;
  if (!c || !/^[a-f0-9]{32}$/.test(c)) { c = crypto.randomBytes(16).toString("hex"); ctx.cookies.rl_csrf = c; setCookie(ctx, "rl_csrf", c, { sameSite: "Strict" }); }
  return hmac("public:" + c);
}
function checkPublicCsrf(ctx) {
  const c = ctx.cookies.rl_csrf, t = ctx.body._csrf;
  if (!c || typeof t !== "string") return false;
  const a = Buffer.from(hmac("public:" + c)), b = Buffer.from(t);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- passwords & sessions ----------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$${salt.toString("hex")}$${h.toString("hex")}`;
}
function verifyPassword(pw, stored) {
  const [alg, N, salt, hash] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const h = crypto.scryptSync(pw, Buffer.from(salt, "hex"), 64, { N: Number(N), r: 8, p: 1 });
  const exp = Buffer.from(hash, "hex");
  return h.length === exp.length && crypto.timingSafeEqual(h, exp);
}
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const SESSION_HOURS = 8;
function createSession(db, ctx, adminId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions(id,admin_id,csrf,expires_at,ip) VALUES (?,?,?,?,?)")
    .run(sha(token), adminId, crypto.randomBytes(24).toString("hex"), Date.now() + SESSION_HOURS * 3600e3, ctx.ip);
  setCookie(ctx, "rl_admin", token, { sameSite: "Strict", maxAge: SESSION_HOURS * 3600 });
}
function loadSession(db, ctx) {
  const t = ctx.cookies.rl_admin;
  if (!t || !/^[a-f0-9]{64}$/.test(t)) return null;
  const s = db.prepare(`SELECT s.id sid, s.csrf, s.expires_at, a.id, a.name, a.email, a.role, a.is_active
    FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.id = ?`).get(sha(t));
  if (!s || s.expires_at < Date.now() || !s.is_active) { if (s) db.prepare("DELETE FROM sessions WHERE id=?").run(s.sid); return null; }
  return s;
}
function destroySession(db, ctx) {
  const t = ctx.cookies.rl_admin;
  if (t) db.prepare("DELETE FROM sessions WHERE id=?").run(sha(t));
  setCookie(ctx, "rl_admin", "", { maxAge: 0 });
}

// ---------- uploads (images + PDF only; type decided by file signature, never by client filename) ----------
function sniff(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: ".jpg", kind: "image" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: ".png", kind: "image" };
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { ext: ".webp", kind: "image" };
  if (buf.subarray(0, 4).toString() === "GIF8") return { ext: ".gif", kind: "image" };
  if (buf.subarray(0, 5).toString() === "%PDF-") return { ext: ".pdf", kind: "pdf" };
  return null;
}
function saveUpload(file, { allowPdf = false, maxBytes = 8 * 1024 * 1024 } = {}) {
  if (!file) return null;
  if (file.data.length > maxBytes) throw Object.assign(new Error("File is too large (max 8 MB)."), { user: true });
  const t = sniff(file.data);
  if (!t || (t.kind === "pdf" && !allowPdf)) throw Object.assign(new Error(allowPdf ? "Upload a JPG, PNG, WebP, GIF or PDF file." : "Upload a JPG, PNG, WebP or GIF image."), { user: true });
  const name = crypto.randomBytes(16).toString("hex") + t.ext;
  fs.mkdirSync(cfg.uploadDir, { recursive: true });
  fs.writeFileSync(path.join(cfg.uploadDir, name), file.data, { mode: 0o644 });
  return "/uploads/" + name;
}

module.exports = { log, clientIp, parseCookies, parseRequest, send, sendHtml, sendJson, redirect, setCookie, serveFile, rateLimit,
  publicCsrf, checkPublicCsrf, hashPassword, verifyPassword, createSession, loadSession, destroySession, saveUpload, sha, hmac };
