"use strict";
// Auto-escaping HTML templates: every interpolated value is escaped unless wrapped in raw() or produced by html``.
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const raw = (s) => new Raw(String(s ?? ""));
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
function render(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join("");
  if (v === null || v === undefined || v === false) return "";
  return esc(v);
}
function html(strs, ...vals) {
  let out = strs[0];
  vals.forEach((v, i) => { out += render(v) + strs[i + 1]; });
  return new Raw(out);
}
const slugify = (s) =>
  String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
const money = (n, cur = "USD") => {
  try { return new Intl.NumberFormat("en", { style: "currency", currency: cur, maximumFractionDigits: cur === "UGX" ? 0 : 2 }).format(n); }
  catch { return `${cur} ${Number(n).toFixed(2)}`; }
};
const fdate = (d) => {
  if (!d) return "";
  const x = new Date(String(d).includes("T") ? d : String(d).replace(" ", "T") + "Z");
  return isNaN(x) ? String(d) : x.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
};
const isEmail = (s) => typeof s === "string" && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const clean = (s, max = 500) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const isUrl = (s) => { try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } };
// Paragraph formatter for plain-text bodies (safe: escapes, then wraps blank-line separated blocks).
const paragraphs = (t) => raw(String(t || "").split(/\n{2,}/).filter(Boolean).map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join(""));
module.exports = { html, raw, esc, Raw, slugify, money, fdate, isEmail, clean, isUrl, paragraphs };
