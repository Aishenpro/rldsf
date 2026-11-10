# Deployment guide

## Host setup

Use a maintained Node.js LTS host or VPS with persistent encrypted storage. Create a dedicated unprivileged service account and directory. Set secrets through the host's secret manager, not files in the repository. Configure `APP_URL` to the public HTTPS origin (the sitemap uses this value), `COOKIE_SECURE=true`, a random `SESSION_SECRET`, and `DATABASE_PATH`/`UPLOAD_DIR` on persistent local storage. Set `TRUST_PROXY=true` only behind a known proxy that overwrites forwarded headers.

Install dependencies with `npm ci`; run migrations and reviewed seeds as a release step. Bootstrap the first administrator interactively through a protected console. Configure HTTPS at Caddy/nginx/managed ingress, redirect HTTP to HTTPS, restrict inbound ports, and proxy to the application port. Configure a process manager for restart and graceful SIGTERM. Do not expose SQLite, uploads, logs, or backups through the static web server.

## Payments and mail

The current code does not complete electronic provider transactions. Keep payment methods disabled until provider integrations, merchant onboarding, callback URLs, webhook signature verification, idempotency, settlement, reconciliation and refund workflows are implemented and reviewed. Never claim a payment is active based on a browser return URL. SMTP credentials and verified sender/domain setup are also required for email features.

## Operations

Monitor `/api/v1/health`, service availability, disk usage, process restarts and backup age. Rotate structured stdout logs at the platform. Back up SQLite with the online backup command and back up uploaded files as a coordinated, encrypted set. Test restore procedures in a separate environment before relying on them. Keep a rollback copy before migrations; migrations are additive by convention. Plan maintenance mode at the reverse proxy/application layer and document incident contacts.

Set DNS A/AAAA records to the proxy and enable certificate renewal. Apply OS and Node dependency security updates under a change process. Define retention, access, deletion, breach response and disaster recovery with leadership and qualified local counsel.
