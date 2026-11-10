# Database notes

SQLite schema begins at `src/database/migrations/001_initial.sql`; safe role seed is `src/database/seeds/001_safe_seed.sql`. Migration runner applies ordered SQL once in a transaction. Foreign keys and WAL are enabled per connection. Timestamps default to UTC SQLite timestamps; event records retain an IANA timezone separately. Fiat values use integer minor units and ISO currency text.

Schema areas include accounts/roles/sessions, member profiles, volunteer/help requests, programmes/campaigns/donations/transactions/refunds/reconciliation/webhook idempotency, posts/events/timeline, gallery/media moderation, team/partners, messages/newsletter/FAQs, homepage/services/evidence-backed impact, settings/policies, and audit logs. Do not store real private data before encryption, retention, access and deletion procedures are reviewed. Financial/legal retention obligations may require anonymization rather than erasure. Avoid deleting ledger records; use status changes and auditable correction entries.

SQLite is a single-host database with limited concurrent writes. Persist the database on local durable storage, use online backup, and consider PostgreSQL when deployment needs multiple app instances, high write concurrency, or managed failover.
