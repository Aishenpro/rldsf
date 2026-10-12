"use strict";
// Payment structure for Stripe (Checkout) and PayPal (Orders v2) using plain fetch (no SDKs).
// Bank transfer and mobile money are recorded as "pending" until an admin confirms receipt.
// NOTE: the Stripe/PayPal calls follow the providers' public REST docs but must be verified with your own
// test keys (Stripe test mode / PayPal sandbox) before going live.
const crypto = require("crypto");
const cfg = require("../../config/config");

const enabled = () => ({
  stripe: !!cfg.pay.stripeKey,
  paypal: !!(cfg.pay.paypalId && cfg.pay.paypalSecret),
  bank_transfer: !!cfg.pay.bank,
  mobile_money: !!cfg.pay.mobile,
});

async function stripeCheckout(d) {
  const p = new URLSearchParams();
  p.set("mode", d.frequency === "monthly" ? "subscription" : "payment");
  p.set("success_url", `${cfg.siteUrl}/donate/thanks/${d.public_code}`);
  p.set("cancel_url", `${cfg.siteUrl}/donate?cancelled=1`);
  p.set("client_reference_id", d.public_code);
  p.set("metadata[donation_code]", d.public_code);
  p.set("customer_email", d.email);
  p.set("line_items[0][quantity]", "1");
  p.set("line_items[0][price_data][currency]", d.currency.toLowerCase());
  p.set("line_items[0][price_data][unit_amount]", String(Math.round(d.amount * 100)));
  p.set("line_items[0][price_data][product_data][name]", "Donation to Rosa Lomba Da Silva Foundation");
  if (d.frequency === "monthly") p.set("line_items[0][price_data][recurring][interval]", "month");
  const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST", headers: { Authorization: "Bearer " + cfg.pay.stripeKey, "Content-Type": "application/x-www-form-urlencoded" }, body: p,
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Stripe: " + (j.error?.message || r.status));
  return { url: j.url, ref: j.id };
}

function verifyStripeSignature(rawBody, header) {
  if (!cfg.pay.stripeWebhook || !header) return false;
  const parts = Object.fromEntries(String(header).split(",").map((s) => s.split("=")));
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;
  const exp = crypto.createHmac("sha256", cfg.pay.stripeWebhook).update(`${parts.t}.${rawBody.toString("utf8")}`).digest("hex");
  const a = Buffer.from(exp), b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function paypalToken() {
  const r = await fetch(cfg.pay.paypalBase + "/v1/oauth2/token", {
    method: "POST", body: "grant_type=client_credentials",
    headers: { Authorization: "Basic " + Buffer.from(cfg.pay.paypalId + ":" + cfg.pay.paypalSecret).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
  });
  const j = await r.json();
  if (!r.ok) throw new Error("PayPal auth failed");
  return j.access_token;
}
async function paypalCreate(d) {
  const t = await paypalToken();
  const r = await fetch(cfg.pay.paypalBase + "/v2/checkout/orders", {
    method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
    body: JSON.stringify({ intent: "CAPTURE",
      purchase_units: [{ custom_id: d.public_code, description: "Donation to Rosa Lomba Da Silva Foundation", amount: { currency_code: d.currency, value: d.amount.toFixed(2) } }],
      application_context: { return_url: `${cfg.siteUrl}/donate/paypal/return?code=${d.public_code}`, cancel_url: `${cfg.siteUrl}/donate?cancelled=1`, user_action: "PAY_NOW" } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("PayPal: " + (j.message || r.status));
  return { url: j.links.find((l) => l.rel === "approve")?.href, ref: j.id };
}
async function paypalCapture(orderId) {
  const t = await paypalToken();
  const r = await fetch(`${cfg.pay.paypalBase}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
  });
  const j = await r.json();
  return r.ok && j.status === "COMPLETED";
}
module.exports = { enabled, stripeCheckout, verifyStripeSignature, paypalCreate, paypalCapture };
