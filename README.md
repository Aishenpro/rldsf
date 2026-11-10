# Rosa Lomba Da Silva Foundation platform

A source project for a responsive nonprofit website and an initial Express/SQLite service layer. It uses Node.js, Express, SQLite, and browser-native HTML/CSS/JavaScript modules. Public facts and contact details are deliberately limited to the information supplied. No user accounts, donations, impact figures, or beneficiary stories are seeded.

## Requirements and first run

Use a Node.js 24 or newer (the application uses the built-in `node:sqlite` module) and npm. Copy `.env.example` to `.env`, set a random `SESSION_SECRET` of at least 32 characters, and choose a persistent `DATABASE_PATH`. Install packages with `npm ci`, then run:

```sh
npm run db:migrate
npm run db:seed
npm run admin:bootstrap
npm start
```

The bootstrap command prompts for an administrator email, display name, and unique password (16+ characters). It creates the first administrator only and refuses when one already exists. Do not put credentials into shell history. Additional accounts must be created through a reviewed invitation workflow; that workflow is not yet implemented in this initial platform build. Public signup creates an inactive/pending member until email verification is configured.

Run the integration suite with `npm test`. Open `APP_URL`. Health endpoint: `/api/v1/health`. `npm run dev` starts Node's watch mode for local development.

## Environment configuration

`PUBLIC_IMAGE_BASE_URL` sets the public image host used by homepage photos and the foundation logo. It defaults to `https://rldsf.byethost7.com/images/`.

See `.env.example`: `NODE_ENV`, `PORT`, `APP_URL`, `PUBLIC_IMAGE_BASE_URL`, `API_BASE_URL`, `DATABASE_PATH`, `SESSION_SECRET`, `COOKIE_SECURE`, `TRUST_PROXY`, `CORS_ALLOWED_ORIGINS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_SECRET_HASH`, `CRYPTO_PROVIDER`, `CRYPTO_API_KEY`, `UPLOAD_DIR`, `MAX_UPLOAD_SIZE`, `LOG_LEVEL`, `ADMIN_BOOTSTRAP_EMAIL`, `WHATSAPP_NUMBER`, `PUBLIC_CONTACT_EMAIL`, `PUBLIC_CONTACT_PHONE`, and `PUBLIC_LOCATION`.

Use real values only in the host's secret manager/environment. Production requires HTTPS, `COOKIE_SECURE=true`, a strong unique secret, a restrictive proxy configuration, persistent database/media storage, and an operational SMTP service. Contact and WhatsApp details are not rendered until a reviewed content implementation is configured.

## Database

Migrations are ordered SQL files in `src/database/migrations`; `npm run db:migrate` applies unapplied files transactionally. `npm run db:seed` inserts roles and permissions only. Add migration files for schema changes; back up before upgrading. SQLite foreign keys are enabled and checked on connection, and WAL mode is used. Monetary values are integer minor units and currency codes are stored per record.

SQLite is appropriate for a modest single-host deployment. It is not a multi-writer distributed database. Use persistent local block storage, avoid network filesystems, and consider PostgreSQL before multi-instance/high-write deployment. Back up using SQLite's online backup API: `npm run db:backup -- /persistent/backups/foundation.sqlite`. Restore only after stopping the app: preserve a copy of the existing database, replace the configured file with a verified backup, restore ownership/permissions, then start and inspect operational records. Back up uploads separately. Store backups encrypted, access-controlled, and outside the web root; define retention with leadership.

## Donations and providers

The donation endpoint stores a pending bank-transfer record and unique reference, but returns no bank coordinates because none were supplied. PayPal and Flutterwave are deliberately unavailable until merchant accounts, credentials, callback/webhook setup, currencies, and jurisdiction are confirmed. The current implementation does not yet create or verify PayPal/Flutterwave checkout sessions, process provider webhooks, issue refunds, generate receipts, or reconcile bank statements. Do not advertise online payment as active.

Cryptocurrency is disabled. No suitable processor has been selected for Uganda and intended donor countries; no simulated success is provided. Before enabling any provider, implement its documented server-side create/verify/webhook/refund flow, signature validation, idempotency and reconciliation; validate provider availability, supported assets/currencies, fees, settlement, refunds, tax/accounting treatment, and credentials with the provider and qualified advisors. Sandbox credentials should be used first. Never put payment secrets in the browser or collect card numbers/private keys.

## Email and operations

SMTP variables are placeholders; transactional email delivery, verification/reset links, unsubscribe handling and notification templates need to be configured and implemented before those workflows can be used. For deployment, terminate TLS at a maintained reverse proxy, forward only trusted proxy headers, set a firewall, run under a dedicated unprivileged account, keep uploads outside public static roots, use persistent storage, rotate logs, monitor disk space, and configure uptime/backup alerts. A maintenance page and incident response procedure should be supplied by the operator. Do not assume ephemeral host disks preserve SQLite or uploads.

## Source layout

See `docs/api.md`, `docs/roles.md`, `docs/database.md`, `docs/payments.md`, `docs/content-and-safeguarding.md`, `docs/privacy-security.md`, `docs/backup-recovery.md`, `deployment-guide.md`, `admin-guide.md`, and `SECURITY.md`.

This is an initial implementation, not an assurance of legal compliance, security, or operational fitness. Independent testing, security review, legal review, provider onboarding, email setup, content approval, and production configuration remain necessary before launch.
