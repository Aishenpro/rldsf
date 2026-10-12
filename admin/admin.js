"use strict";
const crypto = require("crypto");
const H = require("../backend/lib/http");
const { html, raw, esc, slugify, money, fdate, clean } = require("../backend/lib/util");

const ALL = ["super_admin", "editor", "finance"];
const CONTENT = ["super_admin", "editor"], MONEY = ["super_admin", "finance"];
const F = (name, label, type = "text", extra = {}) => ({ name, label, type, ...extra });
const PUB = F("is_published", "Published", "checkbox");

// Each resource drives the list, create and edit screens. `roles` controls who may open it.
const RES = {
  donations: { title: "Donations", table: "donations", roles: MONEY, noCreate: true, order: "id DESC",
    list: ["created_at", "donor_name", "email", "amount", "currency", "method", "frequency", "status"],
    fields: [F("donor_name", "Donor name", "text", { readonly: true }), F("email", "Email", "text", { readonly: true }), F("amount", "Amount", "text", { readonly: true }), F("currency", "Currency", "text", { readonly: true }),
      F("method", "Method", "text", { readonly: true }), F("status", "Status", "select", { options: ["pending", "completed", "failed", "refunded"] }), F("provider_ref", "Provider reference", "text"), F("note", "Internal note", "textarea")],
    beforeSave(db, row, data) { if (data.status === "completed" && !row.paid_at) { data.paid_at = new Date().toISOString().slice(0, 19).replace("T", " ");
        if (!row.receipt_no) data.receipt_no = "RL-" + new Date().getFullYear() + "-" + String(row.id).padStart(5, "0"); } } },
  volunteers: { title: "Volunteers", table: "volunteers", roles: CONTENT, noCreate: true, order: "id DESC", list: ["created_at", "name", "email", "location", "status"],
    fields: ["name", "email", "phone", "location", "skills", "availability", "interests", "message"].map((n) => F(n, n[0].toUpperCase() + n.slice(1), n === "message" ? "textarea" : "text", { readonly: true })).concat([
      F("status", "Status", "select", { options: ["new", "reviewing", "accepted", "declined"] }), F("admin_notes", "Admin notes", "textarea")]) },
  fundraisers: { title: "Fundraisers", table: "fundraisers", roles: CONTENT, noCreate: true, order: "id DESC", list: ["created_at", "title", "target_amount", "currency", "status"],
    fields: [F("title", "Title"), F("description", "Description", "textarea"), F("image", "Image", "file"), F("target_amount", "Target", "number"), F("currency", "Currency"), F("deadline", "Deadline", "date"),
      F("status", "Status (approve to publish)", "select", { options: ["pending", "approved", "rejected", "closed"] }), F("admin_notes", "Admin notes", "textarea")] },
  campaigns: { title: "Campaigns", table: "campaigns", roles: CONTENT, slugFrom: "title", order: "id DESC", list: ["title", "status", "target_amount", "currency"],
    fields: [F("title", "Title", "text", { required: true }), F("description", "Description", "textarea"), F("image", "Image", "file"), F("target_amount", "Target (optional)", "number"), F("currency", "Currency"),
      F("status", "Status", "select", { options: ["draft", "active", "closed"] })] },
  projects: { title: "Projects", table: "projects", roles: CONTENT, slugFrom: "title", order: "sort_order, id", list: ["title", "status", "is_published"],
    fields: [F("title", "Title", "text", { required: true }), F("summary", "Summary"), F("description", "Description", "textarea"), F("goals", "Goals (one per line)", "textarea"), F("image", "Image", "file"),
      F("status", "Status", "select", { options: ["planning", "starting", "active"] }), F("sort_order", "Sort order", "number"), PUB] },
  blog_posts: { title: "Blog", table: "blog_posts", roles: CONTENT, slugFrom: "title", order: "id DESC", list: ["title", "category", "status", "published_at"],
    fields: [F("title", "Title", "text", { required: true }), F("category", "Category"), F("author", "Author"), F("excerpt", "Excerpt", "textarea"), F("body", "Body (blank line = new paragraph)", "textarea", { required: true, rows: 14 }), F("image", "Image", "file"),
      F("meta_title", "SEO title"), F("meta_description", "SEO description"), F("status", "Status", "select", { options: ["draft", "published"] })],
    beforeSave(db, row, data) { if (data.status === "published" && !row?.published_at) data.published_at = new Date().toISOString().slice(0, 19).replace("T", " "); } },
  gallery: { title: "Gallery", table: "gallery", roles: CONTENT, order: "sort_order, id DESC", list: ["image", "album", "caption", "is_published"],
    fields: [F("image", "Image", "file", { required: true }), F("album", "Album"), F("category", "Category"), F("caption", "Caption"), F("alt_text", "Alt text (describe the photo)"), F("sort_order", "Sort order", "number"), PUB] },
  management_team: { title: "Management members", table: "management_team", roles: CONTENT, order: "sort_order, id", list: ["photo", "name", "position", "is_group", "is_published"],
    fields: [F("name", "Name", "text", { required: true }), F("position", "Position"), F("bio", "Biography", "textarea"), F("photo", "Photo", "file"), F("is_group", "This is a group photo", "checkbox"), F("sort_order", "Sort order", "number"), PUB] },
  team_members: { title: "Team members", table: "team_members", roles: CONTENT, order: "sort_order, id", list: ["photo", "name", "role", "is_group", "is_published"],
    fields: [F("name", "Name / caption", "text", { required: true }), F("role", "Role"), F("bio", "Biography", "textarea"), F("photo", "Photo", "file"), F("is_group", "This is a group photo", "checkbox"), F("sort_order", "Sort order", "number"), PUB] },
  partners: { title: "Partners", table: "partners", roles: CONTENT, order: "sort_order, id", list: ["logo", "name", "website", "is_published"],
    fields: [F("name", "Name", "text", { required: true }), F("website", "Website (https://...)"), F("logo", "Logo", "file"), F("description", "Description", "textarea"), F("sort_order", "Sort order", "number"), PUB] },
  financial_reports: { title: "Reports", table: "financial_reports", roles: MONEY, order: "id DESC", list: ["title", "report_type", "period", "is_published"],
    fields: [F("title", "Title", "text", { required: true }), F("report_type", "Type", "select", { options: ["financial", "annual", "project", "other"] }), F("period", "Period (e.g. 2026)"), F("description", "Description", "textarea"),
      F("file", "File (PDF or image)", "file", { pdf: true }), PUB] },
  contacts: { title: "Messages", table: "contacts", roles: CONTENT, noCreate: true, order: "id DESC", list: ["created_at", "name", "email", "subject", "is_read"],
    fields: [F("name", "Name", "text", { readonly: true }), F("email", "Email", "text", { readonly: true }), F("subject", "Subject", "text", { readonly: true }), F("message", "Message", "textarea", { readonly: true }), F("is_read", "Mark as read", "checkbox")] },
  newsletter_subscribers: { title: "Subscribers", table: "newsletter_subscribers", roles: CONTENT, noCreate: true, noEdit: true, order: "id DESC", list: ["email", "created_at"], fields: [] },
  admins: { title: "Admin users", table: "admins", roles: ["super_admin"], noCreate: true, order: "id", list: ["name", "email", "role", "is_active", "last_login_at"],
    fields: [F("name", "Name"), F("email", "Email", "text", { readonly: true }), F("role", "Role", "select", { options: ["super_admin", "editor", "finance"] }), F("is_active", "Active", "checkbox")] },
};
const MENU = ["donations", "volunteers", "fundraisers", "campaigns", "projects", "blog_posts", "gallery", "management_team", "team_members", "partners", "financial_reports", "contacts", "newsletter_subscribers", "admins"];

function shell(ctx, title, body) {
  const a = ctx.admin;
  return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${title} | Admin</title><link rel="icon" href="/assets/images/favicon-32.png"><link rel="stylesheet" href="/assets/css/site.css"><script src="/assets/js/theme-init.js"></script></head>
<body><div class="admin"><aside><img src="/assets/images/logo.png" alt="" width="56" height="56"><p><strong>Foundation admin</strong></p>
<nav aria-label="Admin"><a href="/admin" ${ctx.path === "/admin" ? raw("aria-current=page") : ""}>Dashboard</a>
${MENU.filter((k) => RES[k].roles.includes(a.role)).map((k) => html`<a href="/admin/${k}" ${ctx.path.startsWith("/admin/" + k) ? raw("aria-current=page") : ""}>${RES[k].title}</a>`)}</nav>
<p class="who">${a.name}<br>${a.role.replace("_", " ")}</p>
<a href="/admin/password">Change password</a><a href="/" target="_blank">View website</a>
<form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${a.csrf}"><button class="btn btn-line sm" type="submit">Log out</button></form></aside>
<main id="main">${body}</main></div><script src="/assets/js/site.js" defer></script></body></html>`;
}
const csrfField = (ctx) => html`<input type="hidden" name="_csrf" value="${ctx.admin.csrf}">`;

function loginPage(error, csrf) {
  return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Admin login</title>
<link rel="stylesheet" href="/assets/css/site.css"><script src="/assets/js/theme-init.js"></script></head><body><main class="login card"><img src="/assets/images/logo.png" alt="" width="72" height="72">
<h1>Admin login</h1>${error ? html`<p class="notice err" role="alert">${error}</p>` : ""}
<form class="form" method="post" action="/admin/login"><input type="hidden" name="_csrf" value="${csrf}">
<label for="e">Email</label><input id="e" type="email" name="email" required autocomplete="username"><label for="p">Password</label><input id="p" type="password" name="password" required autocomplete="current-password">
<button class="btn btn-green" type="submit">Log in</button></form></main></body></html>`;
}

function dashboard(ctx, db) {
  const n = (sql, ...p) => db.prepare(sql).get(...p).c;
  const totals = db.prepare("SELECT currency, SUM(amount) t, COUNT(*) c FROM donations WHERE status='completed' GROUP BY currency").all();
  const visitors = db.prepare("SELECT COUNT(DISTINCT day||visitor_hash) c FROM page_views WHERE day >= date('now','-30 day')").get().c;
  const today = db.prepare("SELECT COUNT(DISTINCT visitor_hash) c FROM page_views WHERE day = date('now')").get().c;
  const S = (label, val, href) => html`<a class="stat" href="${href}"><span>${label}</span><b>${val}</b></a>`;
  const showMoney = MONEY.includes(ctx.admin.role);
  return shell(ctx, "Dashboard", html`<h1>Dashboard</h1>
<div class="stats">
${S("Visitors today", today, "/admin")}${S("Visitors, last 30 days", visitors, "/admin")}
${showMoney ? S("Completed donations", totals.length ? totals.map((t) => money(t.t, t.currency)).join(", ") : "None yet", "/admin/donations") : ""}
${showMoney ? S("Pending donations", n("SELECT COUNT(*) c FROM donations WHERE status='pending'"), "/admin/donations") : ""}
${S("New volunteer applications", n("SELECT COUNT(*) c FROM volunteers WHERE status='new'"), "/admin/volunteers")}
${S("Fundraisers awaiting approval", n("SELECT COUNT(*) c FROM fundraisers WHERE status='pending'"), "/admin/fundraisers")}
${S("Unread messages", n("SELECT COUNT(*) c FROM contacts WHERE is_read=0"), "/admin/contacts")}
${S("Newsletter subscribers", n("SELECT COUNT(*) c FROM newsletter_subscribers"), "/admin/newsletter_subscribers")}
</div><p>Visitor counts are anonymous: one daily hash per visitor, no IP addresses stored.</p>`);
}

function cell(col, v) {
  if (v === null || v === undefined || v === "") return "";
  if (["image", "photo", "logo"].includes(col)) return html`<img class="thumb" src="${v}" alt="">`;
  if (["is_published", "is_group", "is_read", "is_active"].includes(col)) return v ? "Yes" : "No";
  if (col === "created_at" || col === "published_at" || col === "last_login_at") return fdate(v);
  return String(v).length > 70 ? String(v).slice(0, 70) + "…" : v;
}
function listPage(ctx, key, db) {
  const r = RES[key];
  const rows = db.prepare(`SELECT * FROM ${r.table} ORDER BY ${r.order} LIMIT 500`).all();
  const cols = r.list;
  return shell(ctx, r.title, html`<h1>${r.title}</h1>${ctx.query.saved ? html`<p class="notice ok" role="status">Saved.</p>` : ""}
<div class="actions">${r.noCreate ? "" : html`<a class="btn btn-green sm" href="/admin/${key}/new">Add new</a>`}</div>
${rows.length ? html`<div><table><thead><tr>${cols.map((c) => html`<th scope="col">${c.replace(/_/g, " ")}</th>`)}<th></th></tr></thead><tbody>
${rows.map((row) => html`<tr>${cols.map((c) => html`<td>${cell(c, row[c])}</td>`)}<td>${r.noEdit ? html`<form method="post" action="/admin/${key}/${row.id}/delete" data-confirm="Delete this entry?">${csrfField(ctx)}<button class="btn btn-danger sm">Delete</button></form>` : html`<a href="/admin/${key}/${row.id}">${r.noCreate && key !== "newsletter_subscribers" ? "Review" : "Edit"}</a>`}</td></tr>`)}</tbody></table></div>` : html`<p>Nothing here yet.</p>`}`);
}
function formPage(ctx, key, row, error) {
  const r = RES[key], v = (n) => row?.[n] ?? "";
  const input = (f) => {
    const id = "f_" + f.name, ro = f.readonly ? raw("readonly") : "";
    if (f.type === "textarea") return html`<label for="${id}">${f.label}</label><textarea id="${id}" name="${f.name}" rows="${f.rows || 5}" ${ro}>${v(f.name)}</textarea>`;
    if (f.type === "select") return html`<label for="${id}">${f.label}</label><select id="${id}" name="${f.name}">${f.options.map((o) => html`<option ${v(f.name) === o ? "selected" : ""}>${o}</option>`)}</select>`;
    if (f.type === "checkbox") return html`<label class="check"><input type="checkbox" name="${f.name}" value="1" ${(row ? v(f.name) : f.name === "is_published" ? 1 : 0) ? "checked" : ""}> ${f.label}</label>`;
    if (f.type === "file") return html`<label for="${id}">${f.label}</label>${v(f.name) ? html`<p>Current: <a href="${v(f.name)}" target="_blank" rel="noopener">${v(f.name)}</a></p>` : ""}<input id="${id}" type="file" name="${f.name}" accept="${f.pdf ? "image/*,application/pdf" : "image/*"}">`;
    return html`<label for="${id}">${f.label}</label><input id="${id}" name="${f.name}" type="${f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}" ${f.type === "number" ? raw('step="any"') : ""} ${f.required ? raw("required") : ""} ${ro} value="${v(f.name)}">`;
  };
  return shell(ctx, r.title, html`<h1>${row ? "Edit" : "Add"} ${r.title.toLowerCase()}</h1>${errorBox(error)}
<form class="form card" method="post" enctype="multipart/form-data" action="/admin/${key}/${row ? row.id : "new"}">${csrfField(ctx)}${r.fields.map(input)}
<div class="actions"><button class="btn btn-green" type="submit">Save changes</button><a href="/admin/${key}">Cancel</a></div></form>
${row && !r.noCreate || (row && r.noCreate && ["contacts", "volunteers", "fundraisers"].includes(key)) ? html`<form method="post" action="/admin/${key}/${row.id}/delete" data-confirm="Delete this entry permanently?">${csrfField(ctx)}<button class="btn btn-danger sm" type="submit">Delete</button></form>` : ""}`);
}
const errorBox = (e) => (e ? html`<p class="notice err" role="alert">${e}</p>` : "");

function uniqueSlug(db, table, base, id = 0) {
  let s = slugify(base), i = 1;
  while (db.prepare(`SELECT 1 FROM ${table} WHERE slug = ? AND id != ?`).get(s, id)) s = slugify(base) + "-" + ++i;
  return s;
}
function audit(db, ctx, action, detail) { db.prepare("INSERT INTO audit_log(admin_id,action,detail,ip) VALUES (?,?,?,?)").run(ctx.admin.id, action, detail, ctx.ip); }

function save(db, ctx, key, id) {
  const r = RES[key], row = id ? db.prepare(`SELECT * FROM ${r.table} WHERE id=?`).get(id) : null;
  if (id && !row) return { notFound: true };
  const data = {};
  try {
    for (const f of r.fields) {
      if (f.readonly) continue;
      if (f.type === "file") { const up = H.saveUpload(ctx.files[f.name], { allowPdf: !!f.pdf }); if (up) data[f.name] = up; else if (f.required && !row?.[f.name]) throw Object.assign(new Error(`${f.label} is required.`), { user: true }); continue; }
      let val = ctx.body[f.name];
      if (f.type === "checkbox") val = val ? 1 : 0;
      else if (f.type === "number") { val = val === "" || val === undefined ? null : Number(val); if (val !== null && !Number.isFinite(val)) throw Object.assign(new Error(`${f.label} must be a number.`), { user: true }); }
      else { val = clean(val, f.type === "textarea" ? 20000 : 300); if (f.required && !val) throw Object.assign(new Error(`${f.label} is required.`), { user: true }); if (val === "") val = null;
        if (f.name === "website" && val && !/^https?:\/\//i.test(val)) throw Object.assign(new Error("Website must start with https://"), { user: true }); }
      if (f.type === "select" && !f.options.includes(val)) throw Object.assign(new Error(`Invalid ${f.label}.`), { user: true });
      if (f.name === "currency" && val) val = String(val).toUpperCase().slice(0, 3);
      data[f.name] = val;
    }
  } catch (e) { if (e.user) return { error: e.message, form: { ...row, ...ctx.body } }; throw e; }
  if (r.slugFrom) data.slug = row ? row.slug : uniqueSlug(db, r.table, data[r.slugFrom]);
  r.beforeSave?.(db, row || {}, data);
  try {
    if (row) {
      const cols = Object.keys(data); if (cols.length) db.prepare(`UPDATE ${r.table} SET ${cols.map((c) => c + "=?").join(",")} WHERE id=?`).run(...cols.map((c) => data[c]), id);
    } else {
      const cols = Object.keys(data);
      const res = db.prepare(`INSERT INTO ${r.table}(${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...cols.map((c) => data[c]));
      id = Number(res.lastInsertRowid);
    }
  } catch (e) { return { error: "Could not save: " + e.message.replace(/^.*constraint failed: /, ""), form: { ...row, ...ctx.body } }; }
  audit(db, ctx, row ? "update" : "create", `${key}#${id}`);
  return { ok: true };
}

// Returns true when the request was handled.
async function handle(ctx, db) {
  const { method, path } = ctx;
  if (path === "/admin/login") {
    if (method === "GET") { H.sendHtml(ctx, loginPage("", H.publicCsrf(ctx))); return true; }
    if (!H.checkPublicCsrf(ctx)) { H.sendHtml(ctx, loginPage("Your session expired. Try again.", H.publicCsrf(ctx)), 403); return true; }
    if (!H.rateLimit(ctx, "login", 8, 15 * 60e3)) { H.sendHtml(ctx, loginPage("Too many attempts. Wait 15 minutes and try again.", H.publicCsrf(ctx)), 429); return true; }
    const a = db.prepare("SELECT * FROM admins WHERE email = ? AND is_active = 1").get(clean(ctx.body.email, 254).toLowerCase());
    const ok = a ? H.verifyPassword(String(ctx.body.password || ""), a.password_hash) : (H.verifyPassword("x", "scrypt$16384$00$00"), false);
    if (!ok) { H.log("warn", "failed admin login", { ip: ctx.ip }); H.sendHtml(ctx, loginPage("Email or password is incorrect.", H.publicCsrf(ctx)), 401); return true; }
    H.createSession(db, ctx, a.id);
    db.prepare("UPDATE admins SET last_login_at = datetime('now') WHERE id=?").run(a.id);
    H.redirect(ctx, "/admin"); return true;
  }
  if (!ctx.admin) { H.redirect(ctx, "/admin/login"); return true; }
  if (method === "POST") {
    if (ctx.body._csrf !== ctx.admin.csrf) { H.sendHtml(ctx, shell(ctx, "Error", html`<h1>Security check failed</h1><p>Reload the page and try again.</p>`), 403); return true; }
  }
  if (path === "/admin/logout" && method === "POST") { H.destroySession(db, ctx); H.redirect(ctx, "/admin/login"); return true; }
  if (path === "/admin" || path === "/admin/") { H.sendHtml(ctx, dashboard(ctx, db)); return true; }
  if (path === "/admin/password") {
    if (method === "GET") { H.sendHtml(ctx, passwordPage(ctx, "")); return true; }
    const a = db.prepare("SELECT * FROM admins WHERE id=?").get(ctx.admin.id), np = String(ctx.body.new_password || "");
    if (!H.verifyPassword(String(ctx.body.current_password || ""), a.password_hash)) { H.sendHtml(ctx, passwordPage(ctx, "Current password is incorrect."), 400); return true; }
    if (np.length < 12 || np !== ctx.body.confirm_password) { H.sendHtml(ctx, passwordPage(ctx, "New password must be at least 12 characters and match the confirmation."), 400); return true; }
    db.prepare("UPDATE admins SET password_hash=? WHERE id=?").run(H.hashPassword(np), a.id);
    db.prepare("DELETE FROM sessions WHERE admin_id=? AND id != ?").run(a.id, ctx.admin.sid); audit(db, ctx, "password_change", "");
    H.sendHtml(ctx, shell(ctx, "Password", html`<h1>Password changed</h1><p>Other sessions were signed out.</p>`)); return true;
  }
  const m = /^\/admin\/([a-z_]+)(?:\/(new|\d+)(?:\/(delete))?)?$/.exec(path);
  if (!m || !RES[m[1]]) return false;
  const key = m[1], r = RES[key], sub = m[2], del = m[3];
  if (!r.roles.includes(ctx.admin.role)) { H.sendHtml(ctx, shell(ctx, "Forbidden", html`<h1>No access</h1><p>Your role does not include this area.</p>`), 403); return true; }
  if (!sub) { H.sendHtml(ctx, listPage(ctx, key, db)); return true; }
  if (sub === "new" && r.noCreate) return false;
  if (del && method === "POST") {
    if (key === "admins") return false;
    try { db.prepare(`DELETE FROM ${r.table} WHERE id=?`).run(Number(sub)); audit(db, ctx, "delete", `${key}#${sub}`); } catch (e) { H.sendHtml(ctx, shell(ctx, "Error", html`<h1>Cannot delete</h1><p>This entry is referenced elsewhere.</p>`), 409); return true; }
    H.redirect(ctx, `/admin/${key}?saved=1`); return true;
  }
  const id = sub === "new" ? 0 : Number(sub);
  if (method === "GET") {
    const row = id ? db.prepare(`SELECT * FROM ${r.table} WHERE id=?`).get(id) : null;
    if (id && !row) return false;
    if (key === "contacts" && row && !row.is_read) db.prepare("UPDATE contacts SET is_read=1 WHERE id=?").run(id);
    H.sendHtml(ctx, formPage(ctx, key, row, "")); return true;
  }
  if (method === "POST") {
    const res = save(db, ctx, key, id);
    if (res.notFound) return false;
    if (res.error) { H.sendHtml(ctx, formPage(ctx, key, res.form && id ? { ...res.form, id } : null, res.error), 400); return true; }
    H.redirect(ctx, `/admin/${key}?saved=1`); return true;
  }
  return false;
}
function passwordPage(ctx, error) {
  return shell(ctx, "Password", html`<h1>Change password</h1>${errorBox(error)}<form class="form card" method="post" action="/admin/password">${csrfField(ctx)}
<label for="c">Current password</label><input id="c" type="password" name="current_password" required autocomplete="current-password">
<label for="n">New password (12+ characters)</label><input id="n" type="password" name="new_password" required minlength="12" autocomplete="new-password">
<label for="m">Confirm new password</label><input id="m" type="password" name="confirm_password" required minlength="12" autocomplete="new-password">
<button class="btn btn-green" type="submit">Change password</button></form>`);
}
module.exports = { handle };
