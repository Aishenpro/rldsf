# Payment integration guide

Payment adapters should implement a common service boundary for `createCheckout`, `verify`, `handleWebhook`, `getStatus`, and `refund`. Validate amount/currency/reference/merchant on the server; process webhook events idempotently in a database transaction; reject invalid transitions; persist provider event identifiers under a uniqueness constraint. Keep secrets server-side and use provider sandbox accounts first.

No checkout adapter beyond a pending bank record exists yet. Bank instructions need verified finance approval. PayPal/Flutterwave require merchant onboarding and current official documentation review. Crypto remains disabled pending provider and jurisdiction review. Live payment configuration is not sufficient by itself to activate payment processing.
