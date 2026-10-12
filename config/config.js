"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.resolve(__dirname, "..");

// Minimal .env loader (no dependency). Real environment variables win.
try {
  for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["\x27]|["\x27]$/g, "");
    }
  }
} catch (_) {}

const e = process.env;
const prod = e.NODE_ENV === "production";
let secret = e.SESSION_SECRET || "";
if (secret.length < 32) {
  if (prod) { console.error("FATAL: SESSION_SECRET must be set (32+ chars) in production."); process.exit(1); }
  secret = crypto.randomBytes(32).toString("hex"); // dev only: sessions reset on restart
}
const port = Number(e.PORT || 3000);
module.exports = {
  ROOT, prod, secret, port,
  siteUrl: (e.SITE_URL || "http://localhost:" + port).replace(/\/$/, ""),
  dbFile: path.resolve(ROOT, e.DB_FILE || "database/foundation.sqlite"),
  trustProxy: e.TRUST_PROXY === "true",
  uploadDir: path.join(ROOT, "uploads"),
  org: {
    name: "Rosa Lomba Da Silva Foundation",
    email: e.ORG_EMAIL || "", phone: e.ORG_PHONE || "", location: e.ORG_LOCATION || "",
    social: { Facebook: e.SOCIAL_FACEBOOK, Instagram: e.SOCIAL_INSTAGRAM, X: e.SOCIAL_X, YouTube: e.SOCIAL_YOUTUBE },
  },
  pay: {
    stripeKey: e.STRIPE_SECRET_KEY || "", stripeWebhook: e.STRIPE_WEBHOOK_SECRET || "",
    paypalId: e.PAYPAL_CLIENT_ID || "", paypalSecret: e.PAYPAL_CLIENT_SECRET || "",
    paypalBase: e.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
    bank: e.BANK_TRANSFER_DETAILS || "", mobile: e.MOBILE_MONEY_DETAILS || "",
  },
  currencies: ["USD", "EUR", "GBP", "UGX"],
};
