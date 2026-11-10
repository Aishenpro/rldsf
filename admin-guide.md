# Administration guide

## First administrator

Install and configure environment first, then run migrations and seed roles. Run `npm run admin:bootstrap` in a trusted interactive terminal. The bootstrap process creates one administrator from supplied credentials; no default accounts or passwords are present. The initial platform does not yet provide staff invitations or a complete user/role management UI.

## Current staff experience

Open `/admin.html`, sign in, and review the overview. Overview figures are database counts; donation figures are grouped by currency and status. The volunteer applications action requires `sensitive.read` in this initial UI/API; help requests are more sensitive and should be limited to explicitly designated staff by adjusting/reviewing role permissions before any use. Status change and event creation APIs enforce permission checks. Event creation requires the `countdown.manage` permission and creates drafts; publication workflows are not yet exposed in the UI.

## Content stewardship

Public content endpoints expose only records in `published` state. Manage structured records through reviewed database migrations/administrative implementation until complete CRUD screens are provided. Homepage editorial records, service cards, impact metrics, team, policies, events, gallery moderation, reports and campaigns have schema support but do not yet have full management interfaces. Never approve an impact figure without its evidence note; never publish beneficiary imagery without documented safeguarding authorization. Do not publish supplied names/titles until leadership verifies them.

## Financial controls

The dashboard groups totals by currency and status. Pending, failed and awaiting-confirmation records are not verified gifts. Bank instructions are not configured. Reconciliation, receipts, refunds and provider transactions require implementation before finance use. Keep dual review and record actual source evidence for any future reconciliation.
