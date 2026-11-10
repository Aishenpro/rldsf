# Security notes and reporting

This repository contains a starting implementation. It has not been security audited. Do not use it to process live payments or store real sensitive records until qualified engineers review and complete the gaps described below.

## Reporting

Do not include personal or beneficiary data in a vulnerability report. The organization has not supplied a security contact; configure an authorized private reporting address before deployment. For a suspected incident, restrict access, preserve relevant logs securely, rotate exposed credentials, and follow the organization's reviewed response and notification plan.

## Current safeguards

- Argon2id password hashing; generic login error; role permissions enforced by backend middleware for implemented staff routes.
- Parameterized SQLite statements, foreign-key enforcement, bounded JSON request bodies, Helmet security headers, restrictive same-origin CSP, HTTP-only SameSite session cookie, rate limit, request IDs, restricted help-request route, and audit entry on sensitive help-list access.
- Public registration assigns only member role and pending status. Bootstrap grants administrator only through a local CLI.

## Required before deployment

The current session store is Express's in-memory default and is not suitable for production. Add a persistent, reviewed session store and CSRF tokens for cookie-authenticated state changes. Implement email verification, password reset, account recovery/revocation, staff invitation, upload handling/moderation, object-level authorization, and full audit coverage. Add validated configured-origin CORS only if cross-origin use is required. Add SMTP delivery and encryption/key management for sensitive records; set retention and deletion controls. Verify every admin action and role assignment. Current help request reads are limited to the `sensitive.read` permission; role mapping should be reviewed and restricted to specifically designated staff before any use. Do not enable live payments until provider API and webhook verification are implemented and reviewed.

Use TLS, secure cookies, secret-manager values, least-privilege database/media access, encrypted backups, patch management, incident response, and independent security review. Never commit `.env`, production databases, uploads, logs, exports or secrets.

A session-bound CSRF token is required on state-changing API requests; browsers obtain it from `GET /api/v1/auth/csrf` and send `X-CSRF-Token`. The public frontend obtains and attaches this token for its requests. The default Express memory session store remains a production blocker and must be replaced with a persistent session store.
