# Content editing and approval

The schema supports homepage sections, service cards, programmes, evidence-backed impact entries, countdown events, team profiles, gallery albums/assets and policy documents. Public read APIs filter to `published`; assets include a moderation state. Full-purpose editorial CRUD screens are not yet implemented. Use an authorized migration/content tool only after review; do not modify database records casually.

For impact publication, attach source/evidence notes and an approval record. Countdown events require `countdown.manage`; use a real date and IANA timezone. Team entries require verified name/title/biography authorization. Gallery items must remain pending until image rights and safeguarding review are recorded. Placeholder logo filename should be `public/images/logo.png` once the official asset is supplied and approved.
