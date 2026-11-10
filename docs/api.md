# API reference (initial)

Base path: `/api/v1`. JSON requests and responses use `{ok, data?, error?, message?}`. Request IDs are returned as `X-Request-Id`. Lists are bounded; news accepts `page` (20 items). Errors avoid internal details.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Process readiness indicator |
| POST | `/auth/register` | Public, rate-limited | Pending member registration |
| POST | `/auth/login` | Public, rate-limited | Session login |
| POST | `/auth/logout` | Session | End session |
| GET | `/auth/me` | Session | Current account |
| GET | `/programmes`, `/programmes/:slug` | Public | Published programme records |
| GET | `/news` | Public | Published paginated news |
| GET | `/events` | Public | Published events |
| GET | `/team`, `/faqs`, `/home` | Public | Approved content |
| POST | `/contact` | Public, rate-limited | Contact form |
| POST | `/newsletter/subscribe` | Public, rate-limited | Consent-based subscription record |
| POST | `/volunteer-applications` | Public, rate-limited | Application submission |
| POST | `/help-requests` | Public, rate-limited | Private referral request |
| POST | `/donations` | Public, rate-limited | Bank pending record; other providers disabled |
| GET | `/admin/overview` | `site.manage` | Operational counts and grouped donation statuses |
| GET | `/admin/applications/volunteers` | `sensitive.read` | Restricted applications |
| GET | `/admin/requests/help` | `sensitive.read` | Restricted help requests; access audit |
| POST | `/admin/events` | `countdown.manage` | Create countdown-capable event draft |

Authentication uses a server session cookie. This initial version lacks a persistent session store, email verification and password recovery; do not expose it for production account use until these are implemented. Provider webhook, refund, reconciliation, invitations, export, campaign submission, and broad CRUD endpoints are not yet implemented.
