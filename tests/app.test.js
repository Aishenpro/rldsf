"use strict";
process.env.BANK_TRANSFER_DETAILS = "Test Bank, account 000";
process.env.SESSION_SECRET = "x".repeat(40);
process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { open } = require("../backend/lib/db");
const { createApp } = require("../backend/server");
const { hashPassword } = require("../backend/lib/http");

let server, base, db;
const jar = {};
const UA = { "User-Agent": "Mozilla/5.0 test" };
async function req(url, opts = {}, who = "anon") {
  jar[who] ??= {};
  const cookie = Object.entries(jar[who]).map(([k, v]) => `${k}=${v}`).join("; ");
  const r = await fetch(base + url, { redirect: "manual", ...opts, headers: { ...UA, ...(cookie ? { Cookie: cookie } : {}), ...(opts.headers || {}) } });
  for (const c of r.headers.getSetCookie()) { const [kv] = c.split(";"); const i = kv.indexOf("="); jar[who][kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); }
  return r;
}
const text = async (url, opts, who) => (await req(url, opts, who)).text();
const csrfFrom = (html) => /name="_csrf" value="([a-f0-9]+)"/.exec(html)[1];
const form = (o) => ({ method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(o).toString() });

test.before(async () => {
  db = open(":memory:");
  db.prepare("INSERT INTO admins(name,email,password_hash,role) VALUES (?,?,?,?)").run("Admin", "a@test.org", hashPassword("correct-horse-battery"), "super_admin");
  db.prepare("INSERT INTO admins(name,email,password_hash,role) VALUES (?,?,?,?)").run("Editor", "e@test.org", hashPassword("correct-horse-battery"), "editor");
  server = createApp(db);
  await new Promise((r) => server.listen(0, r));
  base = "http://127.0.0.1:" + server.address().port;
});
test.after(() => server.close());

test("public pages render and contain no invented numbers or partners", async () => {
  for (const p of ["/", "/about", "/donate", "/volunteer", "/fundraise", "/projects", "/news", "/gallery", "/transparency", "/contact"]) {
    const r = await req(p); assert.equal(r.status, 200, p);
    assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
  }
  const home = await text("/");
  assert.match(home, /Newly established foundation/);
  assert.match(home, /We are building partnerships with organizations and individuals who share our vision\./);
  assert.match(home, /application\/ld\+json/);
  const t = await text("/transparency");
  assert.match(t, /not yet received external donations/);
  assert.equal((await req("/does-not-exist")).status, 404);
});

test("every local asset referenced by the home page exists", async () => {
  const home = await text("/");
  const refs = [...home.matchAll(/(?:src|href)="(\/(?:assets|uploads)[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 8);
  for (const u of new Set(refs)) assert.equal((await req(u)).status, 200, u);
});

test("contact and volunteer forms need CSRF and store data", async () => {
  const page = await text("/contact"); const t = csrfFrom(page);
  assert.equal((await req("/contact", form({ name: "A", email: "a@b.co", message: "hello there" }))).status, 403);
  const ok = await text("/contact", form({ _csrf: t, name: "Ann", email: "ann@example.com", message: "hello there" }));
  assert.match(ok, /received your message/);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM contacts").get().c, 1);
  const v = csrfFrom(await text("/volunteer"));
  await req("/volunteer", form({ _csrf: v, name: "Vic", email: "vic@example.com", skills: "<script>alert(1)</script>" }));
  assert.equal(db.prepare("SELECT COUNT(*) c FROM volunteers").get().c, 1);
});

test("honeypot silently drops bots", async () => {
  const t = csrfFrom(await text("/contact"));
  await req("/contact", form({ _csrf: t, name: "Bot", email: "bot@example.com", message: "buy now", website_url: "http://spam" }));
  assert.equal(db.prepare("SELECT COUNT(*) c FROM contacts WHERE name='Bot'").get().c, 0);
});

test("SQL injection strings are stored as plain data", async () => {
  const t = csrfFrom(await text("/contact"));
  await req("/contact", form({ _csrf: t, name: "x'); DROP TABLE contacts;--", email: "i@example.com", message: "1' OR '1'='1" }));
  assert.ok(db.prepare("SELECT COUNT(*) c FROM contacts").get().c >= 2);
});

test("bank-transfer donation is recorded as pending; admin completes it and a receipt appears", async () => {
  const t = csrfFrom(await text("/donate"));
  const bad = await req("/donate", form({ _csrf: t, name: "D", email: "d@example.com", amount: "-5", currency: "USD", method: "bank_transfer" }));
  assert.equal(bad.status, 400);
  const r = await req("/donate", form({ _csrf: t, name: "Dora", email: "dora@example.com", amount: "25", currency: "USD", frequency: "one_time", method: "bank_transfer", anonymous: "1" }));
  assert.equal(r.status, 303);
  const dn = db.prepare("SELECT * FROM donations").get();
  assert.equal(dn.status, "pending"); assert.equal(dn.is_anonymous, 1); assert.equal(dn.amount, 25);
  assert.match(await text(r.headers.get("location")), /Test Bank, account 000/);
  assert.equal((await req("/receipt/" + dn.public_code)).status, 404);

  // admin login
  const lp = await text("/admin/login", {}, "admin");
  assert.equal((await req("/admin/login", form({ _csrf: "bad", email: "a@test.org", password: "correct-horse-battery" }), "admin")).status, 403);
  const wrong = await req("/admin/login", form({ _csrf: csrfFrom(lp), email: "a@test.org", password: "wrong-password!!" }), "admin");
  assert.equal(wrong.status, 401);
  const good = await req("/admin/login", form({ _csrf: csrfFrom(await text("/admin/login", {}, "admin")), email: "a@test.org", password: "correct-horse-battery" }), "admin");
  assert.equal(good.status, 303);
  assert.ok(jar.admin.rl_admin);
  const dash = await text("/admin", {}, "admin"); assert.match(dash, /Dashboard/); const at = csrfFrom(dash);
  // POST without CSRF is rejected
  assert.equal((await req(`/admin/donations/${dn.id}`, form({ status: "completed" }), "admin")).status, 403);
  const edit = await req(`/admin/donations/${dn.id}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ _csrf: at, status: "completed" }).toString() }, "admin");
  assert.equal(edit.status, 303);
  const done = db.prepare("SELECT * FROM donations WHERE id=?").get(dn.id);
  assert.equal(done.status, "completed"); assert.match(done.receipt_no, /^RL-\d{4}-\d{5}$/);
  assert.match(await text("/receipt/" + dn.public_code), /Donation receipt/);
  assert.match(await text("/transparency"), /Completed donations recorded so far/);
});

test("admin area requires login and enforces roles", async () => {
  assert.equal((await req("/admin")).headers.get("location"), "/admin/login");
  assert.equal((await req("/admin/donations")).status, 303);
  await req("/admin/login", form({ _csrf: csrfFrom(await text("/admin/login", {}, "ed")), email: "e@test.org", password: "correct-horse-battery" }), "ed");
  assert.equal((await req("/admin/donations", {}, "ed")).status, 403);
  assert.equal((await req("/admin/admins", {}, "ed")).status, 403);
  assert.equal((await req("/admin/volunteers", {}, "ed")).status, 200);
});

test("fundraiser needs approval; image upload is validated by file signature", async () => {
  const t = csrfFrom(await text("/fundraise"));
  const fd = (file) => { const f = new FormData(); for (const [k, v] of Object.entries({ _csrf: t, name: "Fay", email: "fay@example.com", title: "Fay's run", description: "Running 10k for the children.", target: "500", currency: "USD" })) f.set(k, v); if (file) f.set("image", file, "x.png"); return { method: "POST", body: f }; };
  const evil = await req("/fundraise", fd(new Blob(["<?php echo 1; ?>"], { type: "image/png" })));
  assert.equal(evil.status, 400);
  const png = fs.readFileSync(path.join(__dirname, "..", "assets/images/favicon-32.png"));
  const ok = await req("/fundraise", fd(new Blob([png], { type: "image/png" })));
  assert.equal(ok.status, 200);
  const f = db.prepare("SELECT * FROM fundraisers").get();
  assert.equal(f.status, "pending"); assert.match(f.image, /^\/uploads\/[a-f0-9]{32}\.png$/);
  assert.equal((await req("/fundraise/" + f.slug)).status, 404);
  db.prepare("UPDATE fundraisers SET status='approved' WHERE id=?").run(f.id);
  assert.equal((await req("/fundraise/" + f.slug)).status, 200);
  assert.equal((await req(f.image)).status, 200);
  fs.unlinkSync(path.join(__dirname, "..", f.image));
});

test("XSS is escaped in public output", async () => {
  db.prepare("INSERT INTO blog_posts(title,slug,body,status,published_at) VALUES (?,?,?,?,datetime('now'))").run("<img src=x onerror=alert(1)>", "xss", "<script>alert(1)</script>", "published");
  const html = await text("/news/xss");
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(!html.includes("<img src=x"));
});

test("path traversal is blocked", async () => {
  for (const u of ["/assets/images/..%2f..%2fconfig/config.js", "/uploads/..%2f.env", "/assets/css/%2e%2e/%2e%2e/package.json"]) {
    assert.notEqual((await req(u)).status, 200, u);
  }
});

test("stripe webhook rejects bad signatures", async () => {
  assert.equal((await req("/webhooks/stripe", { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": "t=1,v1=bad" }, body: "{}" })).status, 400);
});
