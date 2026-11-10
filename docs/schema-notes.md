# Schema notes

See `database.md` for migration behavior and retention considerations. Financial and sensitive records should not be hard-deleted without reviewing applicable retention obligations. Use append-only or audited status corrections for payment records. Add migration files instead of editing migrations already applied in production.
