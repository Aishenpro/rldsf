# Admin guide

Sign in at `/admin`. Roles: **super_admin** (everything), **editor** (content, volunteers, fundraisers, messages), **finance** (donations, reports).

## Daily tasks
- **Donations**: bank-transfer and mobile-money gifts arrive as *pending*. When the money is in your account, open the donation and set status to **completed**. That issues the receipt number and makes `/receipt/<code>` available to the donor. Card and PayPal gifts complete automatically.
- **Volunteers**: open an application, set status (new, reviewing, accepted, declined) and add notes.
- **Fundraisers**: review the page; set status to **approved** to publish it, or **rejected**.
- **Messages**: opening a message marks it read. Reply from your own email.

## Content
Campaigns, Projects, Blog, Gallery, Management members, Team members, Partners and Reports all use the same Add/Edit screen. Uploads accept JPG, PNG, WebP, GIF (reports also PDF), max 8 MB.
- *Published* controls whether an item shows on the website.
- Group photos (tick "group photo") show as wide cards; individual profiles show name, position and biography.
- Add **alt text** for gallery images so the site stays accessible.
- Reports published with a file appear on the Transparency page.

## Admin users
Create the first admin with `npm run create-admin`. Create more the same way, choosing a role: `npm run create-admin -- "Name" email@x.org editor`. Re-running it for an existing email resets that person's password. Deactivate an account in **Admin users** (untick Active).
Change your own password under *Change password*.

## Honest reporting
The Transparency page shows real totals only once completed donations exist. Do not edit donation rows to change totals; use status (failed, refunded) so the history stays accurate. Every admin change is recorded in the `audit_log` table.
