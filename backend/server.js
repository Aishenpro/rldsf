"use strict";
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const cfg = require("../config/config");
const H = require("./lib/http");
const P = require("./lib/payments");
const { open } = require("./lib/db");
const { clean, isEmail, slugify, isUrl } = require("./lib/util");
const V = require("../frontend/views");
const admin = require("../admin/admin");

const STATIC = [
  ["/assets/images/", path.join(cfg.ROOT, "assets", "images"), true],
  ["/assets/css/", path.join(cfg.ROOT, "frontend", "css"), false],
  ["/assets/js/", path.join(cfg.ROOT, "frontend", "js"), false],
  ["/uploads/", cfg.uploadDir, true],
];
const PAGES = ["/", "/about", "/donate", "/volunteer", "/fundraise", "/projects", "/news", "/gallery", "/transparency", "/contact"];
const nowSql = () => new Date().toISOString().slice(0, 19).replace("T", " ");

function createApp(db) {
  const raised = (col, id, cur) => db.prepare(`SELECT COALESCE(SUM(amount),0) s FROM donations WHERE ${col}=? AND currency=? AND status='completed'`).get(id, cur).s;
  const withRaised = (rows, col) => rows.map((r) => ({ ...r, raised: raised(col, r.id, r.currency) }));
  const markPaid = (dn, ref) => {
    const receipt = dn.receipt_no || `RL-${new Date().getFullYear()}-${String(dn.id).padStart(5, "0")}`;
    db.prepare("UPDATE donations SET status='completed', paid_at=COALESCE(paid_at, ?), receipt_no=?, provider_ref=COALESCE(?, provider_ref) WHERE id=?").run(nowSql(), receipt, ref || null, dn.id);
  };
  const formErr = (ctx, render, msg, status = 400) => H.sendHtml(ctx, render(msg), status);
  const guard = (ctx, bucket, max, win) => {
    if (!H.checkPublicCsrf(ctx)) { H.sendHtml(ctx, V.notFound(ctx), 403); return false; }
    if (!H.rateLimit(ctx, bucket, max, win)) { H.send(ctx, 429, "Too many requests. Please wait a few minutes and try again.", "text/plain; charset=utf-8"); return false; }
    return true;
  };

  async function route(ctx) {
    const { method, path: p } = ctx;
    // ---- Stripe webhook (raw body, signature verified; no CSRF) ----
    if (p === "/webhooks/stripe" && method === "POST") {
      if (!P.verifyStripeSignature(ctx.rawBody, ctx.req.headers["stripe-signature"])) return H.send(ctx, 400, "bad signature", "text/plain");
      const ev = JSON.parse(ctx.rawBody.toString("utf8"));
      if (ev.type === "checkout.session.completed") {
        const s = ev.data.object, dn = db.prepare("SELECT * FROM donations WHERE public_code=?").get(s.client_reference_id || "");
        if (dn && dn.status === "pending" && (s.payment_status === "paid" || s.mode === "subscription")) markPaid(dn, s.id);
      }
      return H.send(ctx, 200, "ok", "text/plain");
    }
    if (p === "/health") return H.sendJson(ctx, { ok: !!db.prepare("SELECT 1 x").get() });
    if (p === "/robots.txt") return H.send(ctx, 200, `User-agent: *\nDisallow: /admin\nDisallow: /receipt/\nDisallow: /donate/thanks/\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`, "text/plain; charset=utf-8");
    if (p === "/favicon.ico") return H.redirect(ctx, "/assets/images/favicon-32.png", 301);
    if (p === "/sitemap.xml") {
      const urls = [...PAGES, ...db.prepare("SELECT slug FROM blog_posts WHERE status='published'").all().map((r) => "/news/" + r.slug),
        ...db.prepare("SELECT slug FROM fundraisers WHERE status='approved'").all().map((r) => "/fundraise/" + r.slug)];
      return H.send(ctx, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${cfg.siteUrl}${u}</loc></url>`).join("")}</urlset>`, "application/xml");
    }
    for (const [prefix, dir, imm] of STATIC) if (p.startsWith(prefix) && (method === "GET" || method === "HEAD")) {
      return H.serveFile(ctx, dir, p.slice(prefix.length), { immutable: imm }) || H.sendHtml(ctx, V.notFound(ctx), 404);
    }
    if (p.startsWith("/admin")) { if (await admin.handle(ctx, db)) return; return H.sendHtml(ctx, V.notFound(ctx), 404); }

    if (method === "GET" || method === "HEAD") {
      track(ctx);
      switch (true) {
        case p === "/": return H.sendHtml(ctx, V.home(ctx, {
          management: db.prepare("SELECT * FROM management_team WHERE is_published=1 ORDER BY sort_order,id").all(),
          team: db.prepare("SELECT * FROM team_members WHERE is_published=1 ORDER BY sort_order,id").all(),
          partners: db.prepare("SELECT * FROM partners WHERE is_published=1 ORDER BY sort_order,id").all() }));
        case p === "/about": return H.sendHtml(ctx, V.about(ctx));
        case p === "/donate": return H.sendHtml(ctx, V.donate(ctx, donateData(ctx.query.fundraiser)));
        case p === "/volunteer": return H.sendHtml(ctx, V.volunteer(ctx));
        case p === "/fundraise": return H.sendHtml(ctx, V.fundraise(ctx, { list: withRaised(db.prepare("SELECT * FROM fundraisers WHERE status='approved' ORDER BY id DESC").all(), "fundraiser_id") }));
        case p === "/projects": return H.sendHtml(ctx, V.projects(ctx, db.prepare("SELECT * FROM projects WHERE is_published=1 ORDER BY sort_order,id").all()));
        case p === "/news": {
          const cat = clean(ctx.query.category, 60);
          const posts = cat ? db.prepare("SELECT * FROM blog_posts WHERE status='published' AND category=? ORDER BY published_at DESC").all(cat) : db.prepare("SELECT * FROM blog_posts WHERE status='published' ORDER BY published_at DESC").all();
          const cats = db.prepare("SELECT DISTINCT category c FROM blog_posts WHERE status='published' AND category IS NOT NULL").all().map((r) => r.c);
          return H.sendHtml(ctx, V.news(ctx, posts, cat, cats));
        }
        case p === "/gallery": {
          const album = clean(ctx.query.album, 60);
          const items = album ? db.prepare("SELECT * FROM gallery WHERE is_published=1 AND album=? ORDER BY sort_order,id DESC").all(album) : db.prepare("SELECT * FROM gallery WHERE is_published=1 ORDER BY sort_order,id DESC").all();
          return H.sendHtml(ctx, V.gallery(ctx, items, db.prepare("SELECT DISTINCT album a FROM gallery WHERE is_published=1").all().map((r) => r.a), album));
        }
        case p === "/transparency": {
          const totals = db.prepare("SELECT currency, SUM(amount) total FROM donations WHERE status='completed' GROUP BY currency").all();
          return H.sendHtml(ctx, V.transparency(ctx, { stats: { count: db.prepare("SELECT COUNT(*) c FROM donations WHERE status='completed'").get().c, totals },
            reports: db.prepare("SELECT * FROM financial_reports WHERE is_published=1 AND file IS NOT NULL ORDER BY id DESC").all(),
            posts: db.prepare("SELECT title,slug,published_at FROM blog_posts WHERE status='published' ORDER BY published_at DESC LIMIT 5").all() }));
        }
        case p === "/contact": return H.sendHtml(ctx, V.contact(ctx));
      }
      let m;
      if ((m = /^\/news\/([a-z0-9-]+)$/.exec(p))) { const r = db.prepare("SELECT * FROM blog_posts WHERE slug=? AND status='published'").get(m[1]); if (r) return H.sendHtml(ctx, V.post(ctx, r)); }
      else if ((m = /^\/fundraise\/([a-z0-9-]+)$/.exec(p))) { const r = db.prepare("SELECT * FROM fundraisers WHERE slug=? AND status='approved'").get(m[1]); if (r) return H.sendHtml(ctx, V.fundraiser(ctx, { ...r, raised: raised("fundraiser_id", r.id, r.currency) })); }
      else if ((m = /^\/donate\/thanks\/([a-f0-9]{16})$/.exec(p))) { const r = db.prepare("SELECT * FROM donations WHERE public_code=?").get(m[1]); if (r) return H.sendHtml(ctx, V.donateInstructions(ctx, r)); }
      else if ((m = /^\/receipt\/([a-f0-9]{16})$/.exec(p))) {
        const r = db.prepare("SELECT d.*, c.title ctitle, f.title ftitle FROM donations d LEFT JOIN campaigns c ON c.id=d.campaign_id LEFT JOIN fundraisers f ON f.id=d.fundraiser_id WHERE d.public_code=? AND d.status='completed'").get(m[1]);
        if (r) return H.sendHtml(ctx, V.receipt(r, r.ftitle || r.ctitle));
      } else if (p === "/donate/paypal/return") {
        const dn = db.prepare("SELECT * FROM donations WHERE public_code=? AND method='paypal'").get(clean(ctx.query.code, 20));
        if (dn && dn.provider_ref && dn.provider_ref === ctx.query.token && dn.status === "pending" && (await P.paypalCapture(dn.provider_ref))) markPaid(dn);
        return H.redirect(ctx, dn ? `/donate/thanks/${dn.public_code}` : "/donate");
      }
      return H.sendHtml(ctx, V.notFound(ctx), 404);
    }

    if (method === "POST") {
      const b = ctx.body, spam = !!clean(b.website_url, 10);
      switch (p) {
        case "/subscribe": {
          if (!guard(ctx, "sub", 5, 3600e3)) return;
          if (spam) return H.redirect(ctx, "/");
          if (!isEmail(clean(b.email, 254))) return H.sendHtml(ctx, V.contact(ctx, {}, "Enter a valid email address to subscribe."), 400);
          db.prepare("INSERT OR IGNORE INTO newsletter_subscribers(email) VALUES (?)").run(clean(b.email, 254).toLowerCase());
          return H.redirect(ctx, "/contact?sent=1");
        }
        case "/contact": {
          if (!guard(ctx, "contact", 5, 3600e3)) return;
          if (spam) return H.sendHtml(ctx, V.contact(ctx, {}, "", true));
          const f = { name: clean(b.name, 100), email: clean(b.email, 254), subject: clean(b.subject, 150), message: clean(b.message, 5000) };
          if (!f.name || !isEmail(f.email) || f.message.length < 5) return formErr(ctx, (m) => V.contact(ctx, f, m), "Enter your name, a valid email and a message.");
          db.prepare("INSERT INTO contacts(name,email,subject,message) VALUES (?,?,?,?)").run(f.name, f.email, f.subject, f.message);
          return H.sendHtml(ctx, V.contact(ctx, {}, "", true));
        }
        case "/volunteer": {
          if (!guard(ctx, "vol", 5, 3600e3)) return;
          if (spam) return H.sendHtml(ctx, V.volunteer(ctx, {}, "", true));
          const f = { name: clean(b.name, 100), email: clean(b.email, 254), phone: clean(b.phone, 40), location: clean(b.location, 100), skills: clean(b.skills, 300), availability: clean(b.availability, 300), interests: clean(b.interests, 300), message: clean(b.message, 3000) };
          if (!f.name || !isEmail(f.email)) return formErr(ctx, (m) => V.volunteer(ctx, f, m), "Enter your name and a valid email address.");
          db.prepare("INSERT INTO volunteers(name,email,phone,location,skills,availability,interests,message) VALUES (?,?,?,?,?,?,?,?)").run(...Object.values(f));
          return H.sendHtml(ctx, V.volunteer(ctx, {}, "", true));
        }
        case "/fundraise": {
          if (!guard(ctx, "fund", 3, 3600e3)) return;
          const data = { list: [] };
          if (spam) return H.sendHtml(ctx, V.fundraise(ctx, data, {}, "", true));
          const f = { name: clean(b.name, 100), email: clean(b.email, 254), title: clean(b.title, 120), description: clean(b.description, 5000), target: clean(b.target, 15), currency: clean(b.currency, 3).toUpperCase(), deadline: clean(b.deadline, 10) };
          const target = Number(f.target);
          const bad = !f.name || !isEmail(f.email) || !f.title || f.description.length < 20 ? "Enter your name, a valid email, a title and a description of at least 20 characters."
            : !(target > 0 && target <= 1e9) ? "Enter a target amount above zero." : !cfg.currencies.includes(f.currency) ? "Choose a currency from the list."
            : f.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(f.deadline) ? "Enter the deadline as a date." : "";
          if (bad) return formErr(ctx, (m) => V.fundraise(ctx, data, f, m), bad);
          let image = null;
          try { image = H.saveUpload(ctx.files.image); } catch (e) { if (e.user) return formErr(ctx, (m) => V.fundraise(ctx, data, f, m), e.message); throw e; }
          db.prepare("INSERT OR IGNORE INTO users(name,email) VALUES (?,?)").run(f.name, f.email.toLowerCase());
          const u = db.prepare("SELECT id FROM users WHERE email=?").get(f.email.toLowerCase());
          let slug = slugify(f.title), i = 1; while (db.prepare("SELECT 1 FROM fundraisers WHERE slug=?").get(slug)) slug = slugify(f.title) + "-" + ++i;
          db.prepare("INSERT INTO fundraisers(user_id,title,slug,description,image,target_amount,currency,deadline) VALUES (?,?,?,?,?,?,?,?)").run(u.id, f.title, slug, f.description, image, target, f.currency, f.deadline || null);
          return H.sendHtml(ctx, V.fundraise(ctx, data, {}, "", true));
        }
        case "/donate": return donatePost(ctx, spam);
      }
      return H.sendHtml(ctx, V.notFound(ctx), 404);
    }
    return H.send(ctx, 405, "Method not allowed", "text/plain");
  }

  function donateData(fslug) {
    const fr = fslug ? db.prepare("SELECT * FROM fundraisers WHERE slug=? AND status='approved'").get(clean(fslug, 100)) : null;
    return { enabled: P.enabled(), fundraiser: fr, campaigns: withRaised(db.prepare("SELECT * FROM campaigns WHERE status='active' ORDER BY id DESC").all(), "campaign_id") };
  }
  async function donatePost(ctx, spam) {
    if (!guard(ctx, "donate", 10, 3600e3)) return;
    const b = ctx.body, d = donateData(b.fundraiser);
    if (spam) return H.redirect(ctx, "/donate");
    const f = { name: clean(b.name, 100), email: clean(b.email, 254), amount: clean(b.amount, 12), currency: clean(b.currency, 3).toUpperCase(), frequency: b.frequency === "monthly" ? "monthly" : "one_time",
      method: clean(b.method, 20), campaign: clean(b.campaign, 100), anonymous: b.anonymous ? "1" : "" };
    const amount = Math.round(Number(f.amount) * 100) / 100;
    const err = !f.name || !isEmail(f.email) ? "Enter your name and a valid email address."
      : !(amount >= 1 && amount <= 1e7) ? "Enter an amount of at least 1." : !cfg.currencies.includes(f.currency) ? "Choose a currency from the list."
      : !d.enabled[f.method] ? "Choose an available payment method." : f.method === "paypal" && f.frequency === "monthly" ? "Monthly giving is available by card. Choose card or one-time PayPal." : "";
    if (err) return H.sendHtml(ctx, V.donate(ctx, d, f, err), 400);
    const camp = !d.fundraiser && f.campaign ? db.prepare("SELECT id FROM campaigns WHERE slug=? AND status='active'").get(f.campaign) : null;
    const code = crypto.randomBytes(8).toString("hex");
    const res = db.prepare("INSERT INTO donations(public_code,donor_name,email,is_anonymous,amount,currency,frequency,method,campaign_id,fundraiser_id) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(code, f.name, f.email.toLowerCase(), f.anonymous ? 1 : 0, amount, f.currency, f.frequency, f.method, camp?.id ?? null, d.fundraiser?.id ?? null);
    const dn = { id: Number(res.lastInsertRowid), public_code: code, amount, currency: f.currency, email: f.email, frequency: f.frequency };
    try {
      if (f.method === "stripe" || f.method === "paypal") {
        const r = f.method === "stripe" ? await P.stripeCheckout(dn) : await P.paypalCreate(dn);
        db.prepare("UPDATE donations SET provider_ref=? WHERE id=?").run(r.ref, dn.id);
        return H.redirect(ctx, r.url);
      }
    } catch (e) {
      H.log("error", "payment init failed", { method: f.method, err: e.message });
      db.prepare("UPDATE donations SET status='failed' WHERE id=?").run(dn.id);
      return H.sendHtml(ctx, V.donate(ctx, d, f, "We could not start that payment. Nothing was charged. Please try another method or contact us."), 502);
    }
    return H.redirect(ctx, `/donate/thanks/${code}`);
  }

  function track(ctx) {
    const ua = String(ctx.req.headers["user-agent"] || "");
    if (!ua || /bot|crawl|spider|slurp|monitor|curl/i.test(ua) || ctx.path === "/health") return;
    const day = new Date().toISOString().slice(0, 10);
    db.prepare("INSERT INTO page_views(day,visitor_hash,path) VALUES (?,?,?)").run(day, H.hmac(day + ctx.ip + ua).slice(0, 16), ctx.path.slice(0, 200));
  }

  return http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    const ctx = { req, res, method: req.method, path: u.pathname.replace(/(.)\/+$/, "$1"), query: Object.fromEntries(u.searchParams), cookies: H.parseCookies(req.headers.cookie),
      setCookies: [], ip: H.clientIp(req), body: {}, files: {}, admin: null };
    ctx.csrf = () => H.publicCsrf(ctx);
    try {
      if (ctx.path.includes("\0") || ctx.path.includes("..")) return H.send(ctx, 400, "Bad request", "text/plain");
      if (!H.rateLimit(ctx, "global", 300, 60e3)) return H.send(ctx, 429, "Too many requests", "text/plain");
      if (req.method === "POST") Object.assign(ctx, await H.parseRequest(req, { raw: ctx.path === "/webhooks/stripe" }));
      if (ctx.path.startsWith("/admin")) ctx.admin = H.loadSession(db, ctx);
      await route(ctx);
    } catch (e) {
      H.log("error", "request failed", { path: ctx.path, err: e.message, stack: cfg.prod ? undefined : e.stack });
      if (!res.headersSent) { try { H.sendHtml(ctx, V.notFound(ctx).s.replace("Page not found", e.status === 413 ? "Request too large" : "Something went wrong"), e.status || 500); } catch { res.writeHead(500).end(); } }
    }
  });
}

if (require.main === module) {
  const db = open();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  const server = createApp(db);
  server.listen(cfg.port, () => H.log("info", `Foundation site running on ${cfg.siteUrl} (port ${cfg.port})`));
  const stop = () => { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
}
module.exports = { createApp };
