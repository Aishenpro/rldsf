# Deployment guide

## Requirements
Node.js **22.13 or newer** (22 LTS is fine), a server or host that can run a long-lived Node process, and HTTPS in front of it.

## 1. Configure
```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # paste as SESSION_SECRET
```
Set `NODE_ENV=production`, `SITE_URL=https://your-domain`, and `TRUST_PROXY=true` if behind nginx/Caddy/Cloudflare.
In production the server refuses to start without a strong `SESSION_SECRET`. `.env` must never be committed or shared.

## 2. Run
**Plain Node + systemd**
```ini
[Service]
WorkingDirectory=/srv/foundation
EnvironmentFile=/srv/foundation/.env
ExecStart=/usr/bin/node backend/server.js
Restart=always
User=foundation
```
**Docker**: `docker compose -f docker/docker-compose.yml up -d --build` (database and uploads live in named volumes).
Then create the first admin: `docker compose -f docker/docker-compose.yml exec web node backend/create-admin.js "Name" you@org.org`.

## 3. HTTPS
Use `docker/Caddyfile.example` (automatic certificates) or nginx + Certbot, proxying to port 3000. Redirect HTTP to HTTPS. The app sets HSTS and secure cookies in production.

## 4. Payments
- **Stripe**: set `STRIPE_SECRET_KEY`. In the Stripe dashboard add a webhook to `https://your-domain/webhooks/stripe` for `checkout.session.completed` and set `STRIPE_WEBHOOK_SECRET`. Monthly gifts use Stripe subscriptions; the first payment is recorded automatically. **Later monthly renewals are not yet recorded** (add an `invoice.paid` handler, or record them from the Stripe dashboard).
- **PayPal**: set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=sandbox` (then `live`). PayPal is one-time only in this version.
- **Bank transfer / mobile money**: put the instructions in `BANK_TRANSFER_DETAILS` / `MOBILE_MONEY_DETAILS`. A method with no details is hidden from the form.
- **Test every method with test credentials before going live.** The Stripe/PayPal integration was written to the providers' public REST documentation and could not be run against their servers during development.

## 5. Backups
Back up two things: the SQLite file (`DB_FILE`, default `database/foundation.sqlite`; use `sqlite3 file ".backup backup.db"` or copy while the app is stopped) and the `uploads/` folder. Do this daily and keep a copy off the server.

## 6. Updating
Replace the code, keep `.env`, `database/` and `uploads/`, restart. New migrations in `database/migrations/` run automatically at startup.

## 7. Moving to MySQL/PostgreSQL later
Tables use standard types and foreign keys. Port `001_init.sql` (replace `INTEGER PRIMARY KEY` with auto-increment/serial, `datetime('now')` with `CURRENT_TIMESTAMP`) and swap `backend/lib/db.js`; queries are isolated in `server.js` and `admin/admin.js`.

## Health check and logs
`GET /health` returns `{"ok":true}`. Logs are JSON lines on stdout and in `logs/app.log`.

## Known limits
No outgoing email (donor receipts are viewable online; messages and applications are read in the dashboard). Rate limiting is in memory, so it resets on restart and is per-process.
