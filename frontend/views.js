"use strict";
const cfg = require("../config/config");
const { html, raw, esc, money, fdate, paragraphs } = require("../backend/lib/util");
const org = cfg.org;
const IMG = (p) => p || "/assets/images/og-image.jpg";

const NAV = [["/", "Home"], ["/about", "About"], ["/projects", "Projects"], ["/news", "News"], ["/gallery", "Gallery"], ["/transparency", "Transparency"], ["/contact", "Contact"]];

function layout(ctx, { title, desc, path = ctx.path, body, image, jsonld, noindex }) {
  const full = title === org.name ? title : `${title} | ${org.name}`;
  const url = cfg.siteUrl + path;
  const ld = jsonld || null;
  const social = Object.entries(org.social).filter(([, v]) => v);
  return html`<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${full}</title>
<meta name="description" content="${desc}">
${noindex ? raw('<meta name="robots" content="noindex">') : ""}
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${org.name}">
<meta property="og:title" content="${full}"><meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${cfg.siteUrl + IMG(image)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${full}">
<meta name="twitter:description" content="${desc}"><meta name="twitter:image" content="${cfg.siteUrl + IMG(image)}">
<link rel="icon" href="/assets/images/favicon-32.png" sizes="32x32"><link rel="apple-touch-icon" href="/assets/images/favicon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/site.css">
<script src="/assets/js/theme-init.js"></script>
<script type="application/ld+json">${raw(JSON.stringify({
    "@context": "https://schema.org", "@type": "NGO", name: org.name, url: cfg.siteUrl, logo: cfg.siteUrl + "/assets/images/logo.png",
    description: "A newly established children's charity founded in memory of Rosa Lomba Da Silva.",
    ...(org.email ? { email: org.email } : {}), ...(org.phone ? { telephone: org.phone } : {}),
    ...(org.location ? { address: { "@type": "PostalAddress", addressLocality: org.location } } : {}),
    ...(social.length ? { sameAs: social.map(([, v]) => v) } : {}),
  }).replace(/</g, "\\u003c"))}</script>
${ld ? raw(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`) : ""}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="/"><img src="/assets/images/logo.png" alt="" width="44" height="44"><span>Rosa Lomba<br>Da Silva Foundation</span></a>
    <button class="nav-toggle" aria-expanded="false" aria-controls="nav" aria-label="Menu"><span></span><span></span><span></span></button>
    <nav id="nav" aria-label="Main">
      ${NAV.map(([h, t]) => html`<a href="${h}" ${h === ctx.path || (h !== "/" && ctx.path.startsWith(h)) ? raw('aria-current="page"') : ""}>${t}</a>`)}
      <button class="theme-btn" type="button" aria-label="Switch light or dark theme">Theme</button>
      <a class="btn btn-gold sm" href="/donate">Donate</a>
    </nav>
  </div>
</header>
<main id="main">${body}</main>
<footer class="site-footer">
  <div class="wrap foot-grid">
    <div><img src="/assets/images/logo.png" alt="" width="64" height="64" loading="lazy">
      <p>Founded in loving memory of Rosa Lomba Da Silva, to give children compassion, opportunity and hope.</p></div>
    <div><h2>Get involved</h2><ul><li><a href="/donate">Donate</a></li><li><a href="/volunteer">Volunteer</a></li><li><a href="/fundraise">Fundraise for us</a></li><li><a href="/contact">Partner with us</a></li></ul></div>
    <div><h2>Learn more</h2><ul><li><a href="/about">About us</a></li><li><a href="/projects">Projects</a></li><li><a href="/transparency">Transparency</a></li><li><a href="/news">News</a></li></ul></div>
    <div><h2>Stay in touch</h2>
      <form method="post" action="/subscribe" class="inline-form">
        <input type="hidden" name="_csrf" value="${ctx.csrf()}">
        <label class="sr" for="nl">Email address</label><input id="nl" type="email" name="email" placeholder="Your email" required autocomplete="email">
        <button class="btn btn-gold sm" type="submit">Subscribe</button>
      </form>
      ${org.email ? html`<p><a href="mailto:${org.email}">${org.email}</a></p>` : ""}
      ${social.length ? html`<p class="social">${social.map(([n, u]) => html`<a href="${u}" rel="noopener" target="_blank">${n}</a> `)}</p>` : ""}
    </div>
  </div>
  <div class="wrap legal"><p>&copy; ${new Date().getFullYear()} ${org.name}. A new foundation, growing openly.</p></div>
</footer>
<script src="/assets/js/site.js" defer></script>
</body></html>`;
}

const pageHead = (title, lead) => html`<section class="page-head"><div class="wrap narrow"><h1>${title}</h1>${lead ? html`<p class="lead">${lead}</p>` : ""}</div></section>`;
const flash = (ctx) => (ctx.query.sent ? html`<p class="notice ok" role="status">Thank you. We have received your message and will be in touch.</p>` : "");
const csrf = (ctx) => html`<input type="hidden" name="_csrf" value="${ctx.csrf()}">`;
const errBox = (e) => (e ? html`<p class="notice err" role="alert">${e}</p>` : "");
const trap = html`<div class="hp" aria-hidden="true"><label>Leave this empty <input name="website_url" tabindex="-1" autocomplete="off"></label></div>`;
const STATUS = { planning: "Planning", starting: "Starting", active: "Active" };
const progress = (raised, target, cur) => html`<div class="prog"><progress max="${target}" value="${Math.min(raised, target)}" aria-label="Fundraising progress"></progress><p><strong>${money(raised, cur)}</strong> raised of ${money(target, cur)} goal</p></div>`;

// ---------------- HOME ----------------
function home(ctx, d) {
  const lead = d.management.filter((m) => !m.is_group);
  const mgGroup = d.management.find((m) => m.is_group);
  return layout(ctx, {
    title: org.name, desc: "Building brighter futures for children through compassion, opportunity, and community support. A new foundation in memory of Rosa Lomba Da Silva.",
    body: html`
<section class="hero"><div class="wrap hero-grid">
  <div>
    <h1>Building brighter futures for children through compassion, opportunity, and community support.</h1>
    <p class="lead">We are a new children's charity into our journey. Everything we do begins with one woman's example of kindness.</p>
    <p class="cta-row"><a class="btn btn-gold" href="/donate">Donate Now</a><a class="btn btn-green" href="/volunteer">Become a Volunteer</a><a class="btn btn-line" href="/fundraise">Support Our Mission</a></p>
  </div>
  <figure class="portrait"><img src="/assets/images/founder-mother.png" alt="Portrait of Rosa Lomba Da Silva" width="520" height="517" fetchpriority="high"><figcaption>In loving memory of<br><strong>Rosa Lomba Da Silva</strong></figcaption></figure>
</div></section>

<section class="band"><div class="wrap two">
  <div><h2>Where we are today</h2><p>We believe in telling you exactly where we stand. We are not yet a large organisation, and we would rather be honest than impressive.</p></div>
  <ul class="status-list">
    <li>Newly established foundation</li>
    <li>A small, dedicated founding team</li>
    <li>Supporting a small number of children while we build our programmes</li>
    <li>Beginning conversations with partners</li>
    <li>Looking for our first donors, volunteers and fundraisers</li>
  </ul>
</div></section>

<section class="section"><div class="wrap two flip">
  <figure class="tribute"><img src="/assets/images/founder-mother.png" alt="Rosa Lomba Da Silva" width="400" height="398" loading="lazy"></figure>
  <div><h2>Why our name is Rosa</h2>
    <p>Rosa Lomba Da Silva is the mother of our founder. This foundation carries her name because of how she lived: caring for others and believing that every child deserves a chance.</p>
    <p>We want to turn the love she gave into practical help for children.</p>
    <p><a class="link" href="/about">Read our story</a></p></div>
</div></section>

<section class="section tint"><div class="wrap">
  <h2 class="center">Three ways to help us start well</h2>
  <p class="center lead narrow">Become one of the first supporters helping us create meaningful change.</p>
  <div class="grid3">
    <article class="card"><h3>Donate</h3><p>Give once or monthly. Every gift in these early days shapes what we can build.</p><a class="btn btn-gold sm" href="/donate">Give now</a></article>
    <article class="card"><h3>Volunteer</h3><p>Share your time and skills. We will match you with something that fits your availability.</p><a class="btn btn-green sm" href="/volunteer">Offer your help</a></article>
    <article class="card"><h3>Fundraise</h3><p>Start a page for a birthday, event or challenge and rally friends around our mission.</p><a class="btn btn-blue sm" href="/fundraise">Start fundraising</a></article>
  </div>
</div></section>

${d.management.length ? html`<section class="section"><div class="wrap"><h2>Leadership</h2>
  <div class="lead-grid">
    ${mgGroup ? html`<figure class="photo-card"><img src="${mgGroup.photo}" alt="${mgGroup.name}" width="1100" height="1098" loading="lazy"><figcaption>${mgGroup.name}</figcaption></figure>` : ""}
    <div class="profiles">${lead.map((m) => html`<article class="profile"><img src="${m.photo}" alt="${m.name}" width="900" height="900" loading="lazy"><div><h3>${m.name}</h3><p class="role">${m.position}</p><p>${m.bio}</p></div></article>`)}</div>
  </div></div></section>` : ""}

${d.team.length ? html`<section class="section tint"><div class="wrap"><h2>Our team</h2><p class="lead">The people behind the foundation.</p>
  <div class="grid2">${d.team.map((t) => html`<figure class="photo-card"><img src="${t.photo}" alt="${t.name}" width="1600" height="900" loading="lazy"><figcaption>${t.name}${t.role ? html`<span>${t.role}</span>` : ""}</figcaption></figure>`)}</div>
</div></section>` : ""}

<section class="section"><div class="wrap center"><h2>Partners</h2>${partnersBlock(d.partners)}</div></section>
`,
  });
}
function partnersBlock(partners) {
  return html`<p class="lead">We are building partnerships with organizations and individuals who share our vision.</p>
  ${partners.length ? html`<ul class="partners">${partners.map((p) => html`<li>${p.logo ? html`<img src="${p.logo}" alt="${p.name}" loading="lazy" width="300" height="261">` : ""}<span>${p.website ? html`<a href="${p.website}" rel="noopener">${p.name}</a>` : p.name}</span></li>`)}</ul>` : ""}
  <p><a class="link" href="/contact">Interested in partnering? Get in touch</a></p>`;
}

// ---------------- ABOUT ----------------
function about(ctx) {
  return layout(ctx, { title: "About us", desc: "The story of the Rosa Lomba Da Silva Foundation, our mission, vision and values.", image: "/assets/images/founder-mother.png",
    body: html`${pageHead("About us", "A young foundation with a long inheritance of kindness.")}
<section class="section"><div class="wrap two"><figure class="tribute"><img src="/assets/images/founder-mother.png" alt="Rosa Lomba Da Silva" width="400" height="398" loading="lazy"></figure>
<div><h2>Our story</h2>
<p>The Rosa Lomba Da Silva Foundation was created in memory of the founder's late mother with a small founding team and a simple wish: to turn a mother's love into care for children who need it.</p>
<p>We have not yet received outside donations or funding, and we currently support a small number of children. We are sharing our beginning openly so that supporters can grow with us and see exactly how their help is used.</p>
<h3>The meaning behind the name</h3>
<p>Naming the foundation after Rosa Lomba Da Silva keeps her memory present in everything we do. Her example reminds us to act with warmth, honesty and generosity.</p></div></div></section>
<section class="section tint"><div class="wrap two">
<div><h2>Mission</h2><p>To give children compassion, opportunity and community support, and to grow in a transparent and sustainable way.</p></div>
<div><h2>Vision</h2><p>A world where every child is safe, cared for and hopeful about the future.</p></div></div></section>
<section class="section"><div class="wrap"><h2>Our values</h2><div class="grid3 values">
${[["Compassion", "We meet every child and family with kindness."], ["Integrity", "We do what we say and own our mistakes."], ["Transparency", "We share what we receive and how it is spent."], ["Equality", "Every child matters equally, whoever they are."], ["Responsibility", "We treat every donation and every child as a trust."], ["Hope", "We build for the long term, one step at a time."]]
  .map(([t, p]) => html`<article class="card"><h3>${t}</h3><p>${p}</p></article>`)}</div></div></section>` });
}

// ---------------- DONATE ----------------
function donate(ctx, d, form = {}, error = "") {
  const en = d.enabled;
  const methods = [["stripe", "Card (Stripe)"], ["paypal", "PayPal"], ["bank_transfer", "Bank transfer"], ["mobile_money", "Mobile money"]].filter(([k]) => en[k]);
  const pick = (k) => form[k] ?? "";
  return layout(ctx, { title: "Donate", desc: "Become one of the first supporters helping us create meaningful change. Give once or monthly to the Rosa Lomba Da Silva Foundation.",
    body: html`${pageHead("Donate", "Become one of the first supporters helping us create meaningful change.")}
<section class="section"><div class="wrap two top">
<form method="post" action="/donate" class="form card" novalidate>
  ${csrf(ctx)}${trap}${errBox(error)}
  ${ctx.query.cancelled ? html`<p class="notice err">Your payment was not completed. You can try again below.</p>` : ""}
  ${d.fundraiser ? html`<p class="notice ok">Giving through the fundraiser <strong>${d.fundraiser.title}</strong>.</p><input type="hidden" name="fundraiser" value="${d.fundraiser.slug}">` : ""}
  <fieldset><legend>How often?</legend>
    <label class="choice"><input type="radio" name="frequency" value="one_time" ${pick("frequency") !== "monthly" ? "checked" : ""}> One-time</label>
    <label class="choice"><input type="radio" name="frequency" value="monthly" ${pick("frequency") === "monthly" ? "checked" : ""}> Monthly</label>
  </fieldset>
  <fieldset><legend>Amount</legend>
    <div class="amounts">${[10, 25, 50, 100].map((a) => html`<button type="button" class="chip" data-amount="${a}">${a}</button>`)}</div>
    <div class="row"><div><label for="amount">Custom amount</label><input id="amount" name="amount" type="number" min="1" step="0.01" inputmode="decimal" required value="${pick("amount")}"></div>
    <div><label for="currency">Currency</label><select id="currency" name="currency">${cfg.currencies.map((c) => html`<option ${pick("currency") === c ? "selected" : ""}>${c}</option>`)}</select></div></div>
  </fieldset>
  ${!d.fundraiser && d.campaigns.length ? html`<label for="campaign">Where should it go?</label><select id="campaign" name="campaign"><option value="">Where it is needed most</option>${d.campaigns.map((c) => html`<option value="${c.slug}" ${pick("campaign") === c.slug ? "selected" : ""}>${c.title}</option>`)}</select>` : ""}
  <label for="name">Your name</label><input id="name" name="name" autocomplete="name" required value="${pick("name")}">
  <label for="email">Email (for your receipt)</label><input id="email" type="email" name="email" autocomplete="email" required value="${pick("email")}">
  <label class="check"><input type="checkbox" name="anonymous" value="1" ${pick("anonymous") ? "checked" : ""}> Keep my donation anonymous in public listings</label>
  <fieldset><legend>Payment method</legend>
    ${methods.length ? methods.map(([k, t], i) => html`<label class="choice"><input type="radio" name="method" value="${k}" ${pick("method") === k || (!pick("method") && i === 0) ? "checked" : ""}> ${t}</label>`)
      : html`<p class="notice err">Online giving is not switched on yet. Please <a href="/contact">contact us</a> and we will help you give.</p>`}
  </fieldset>
  ${methods.length ? html`<button class="btn btn-gold" type="submit">Continue to payment</button><p class="small">PayPal gifts are one-time; choose card for monthly giving. Bank transfer and mobile money are confirmed by our team once received.</p>` : ""}
</form>
<aside><div class="card tint-card"><h2>Why your gift matters now</h2>
<p>We are brand new, so early gifts go a long way. We will report openly on what we receive and how it is used. See our <a href="/transparency">transparency page</a>.</p></div>
${d.campaigns.length ? html`<h2 class="mt">Active campaigns</h2>${d.campaigns.map((c) => html`<div class="card"><h3>${c.title}</h3><p>${c.description}</p>${c.target_amount ? progress(c.raised, c.target_amount, c.currency) : ""}</div>`)}` : ""}
</aside></div></section>` });
}
function donateInstructions(ctx, dn) {
  const body = dn.method === "bank_transfer" ? cfg.pay.bank : cfg.pay.mobile;
  return layout(ctx, { title: "Thank you", desc: "Thank you for your donation.", noindex: true,
    body: html`${pageHead("Thank you", "Your pledge has been recorded.")}
<section class="section"><div class="wrap narrow"><div class="card">
<p>Reference: <strong>${dn.public_code.toUpperCase()}</strong></p>
${dn.status === "completed" ? html`<p>Your donation of <strong>${money(dn.amount, dn.currency)}</strong> is confirmed. <a class="link" href="/receipt/${dn.public_code}">View your receipt</a>.</p>`
  : dn.method === "bank_transfer" || dn.method === "mobile_money" ? html`<p>Please send <strong>${money(dn.amount, dn.currency)}</strong> using the details below and include your reference.</p><pre class="pay">${body}</pre><p>We will email or confirm your receipt after we receive it.</p>`
  : html`<p>We are waiting for confirmation from the payment provider. Your receipt will be available as soon as the payment is confirmed.</p>`}
<p><a class="btn btn-green sm" href="/">Back to home</a></p></div></div></section>` });
}
function receipt(dn, camp) {
  return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Receipt ${dn.receipt_no}</title><link rel="stylesheet" href="/assets/css/site.css"></head><body class="receipt-body"><main class="receipt">
<img src="/assets/images/logo.png" alt="" width="72" height="72"><h1>Donation receipt</h1><p>${org.name}</p>
<dl><dt>Receipt no.</dt><dd>${dn.receipt_no}</dd><dt>Date</dt><dd>${fdate(dn.paid_at)}</dd><dt>Donor</dt><dd>${dn.donor_name}</dd>
<dt>Amount</dt><dd>${money(dn.amount, dn.currency)} ${dn.frequency === "monthly" ? "(monthly)" : ""}</dd><dt>Method</dt><dd>${dn.method.replace("_", " ")}</dd>
<dt>Purpose</dt><dd>${camp || "Where it is needed most"}</dd></dl>
<p class="small">Thank you for being one of our first supporters. Please keep this receipt for your records. This receipt acknowledges a gift; it does not state tax-deductibility.</p>
<button class="btn btn-green" id="print">Print receipt</button></main><script src="/assets/js/receipt.js"></script></body></html>`;
}

// ---------------- VOLUNTEER ----------------
function volunteer(ctx, form = {}, error = "", done = false) {
  const v = (k) => form[k] ?? "";
  return layout(ctx, { title: "Volunteer", desc: "Offer your time and skills to the Rosa Lomba Da Silva Foundation.",
    body: html`${pageHead("Become a volunteer", "We are just starting out, and your time and skills can help shape how we grow.")}
<section class="section"><div class="wrap narrow">${done ? html`<p class="notice ok" role="status">Thank you. Your application is with our team and we will contact you soon.</p>` : html`
<form class="form card" method="post" action="/volunteer">${csrf(ctx)}${trap}${errBox(error)}
<label for="name">Full name</label><input id="name" name="name" required autocomplete="name" value="${v("name")}">
<div class="row"><div><label for="email">Email</label><input id="email" type="email" name="email" required autocomplete="email" value="${v("email")}"></div>
<div><label for="phone">Phone</label><input id="phone" name="phone" type="tel" autocomplete="tel" value="${v("phone")}"></div></div>
<label for="location">Country / location</label><input id="location" name="location" value="${v("location")}">
<label for="skills">Skills</label><input id="skills" name="skills" placeholder="Teaching, design, accounting, social media..." value="${v("skills")}">
<label for="availability">Availability</label><input id="availability" name="availability" placeholder="Weekends, two evenings a week..." value="${v("availability")}">
<label for="interests">Areas you are interested in</label><input id="interests" name="interests" placeholder="Education, wellbeing, fundraising..." value="${v("interests")}">
<label for="message">Message</label><textarea id="message" name="message" rows="5">${v("message")}</textarea>
<button class="btn btn-green" type="submit">Send application</button></form>`}</div></section>` });
}

// ---------------- FUNDRAISE ----------------
function fundraise(ctx, d, form = {}, error = "", done = false) {
  const v = (k) => form[k] ?? "";
  return layout(ctx, { title: "Fundraise for us", desc: "Start a fundraising page for the Rosa Lomba Da Silva Foundation.",
    body: html`${pageHead("Fundraise for us", "Rally your friends, family or community. Every page is reviewed by our team before it goes live.")}
<section class="section"><div class="wrap two top">
<div>${done ? html`<p class="notice ok" role="status">Thank you. Your fundraiser has been sent for approval. We will email you when it is live.</p>` : html`
<form class="form card" method="post" action="/fundraise" enctype="multipart/form-data">${csrf(ctx)}${trap}${errBox(error)}
<label for="name">Your name</label><input id="name" name="name" required value="${v("name")}">
<label for="email">Your email</label><input id="email" type="email" name="email" required value="${v("email")}">
<label for="title">Campaign title</label><input id="title" name="title" required maxlength="120" value="${v("title")}">
<label for="description">Why are you fundraising?</label><textarea id="description" name="description" rows="6" required>${v("description")}</textarea>
<div class="row"><div><label for="target">Target amount</label><input id="target" type="number" name="target" min="1" step="1" required value="${v("target")}"></div>
<div><label for="currency">Currency</label><select id="currency" name="currency">${cfg.currencies.map((c) => html`<option>${c}</option>`)}</select></div></div>
<label for="deadline">Deadline</label><input id="deadline" type="date" name="deadline" value="${v("deadline")}">
<label for="image">Image (JPG, PNG or WebP, max 8 MB)</label><input id="image" type="file" name="image" accept="image/jpeg,image/png,image/webp">
<button class="btn btn-blue" type="submit">Submit for approval</button></form>`}</div>
<aside><h2>Live fundraisers</h2>${d.list.length ? d.list.map((f) => html`<article class="card"><h3><a href="/fundraise/${f.slug}">${f.title}</a></h3>${progress(f.raised, f.target_amount, f.currency)}</article>`)
  : html`<p>No fundraisers are live yet. Yours could be the first.</p>`}</aside></div></section>` });
}
function fundraiser(ctx, f) {
  return layout(ctx, { title: f.title, desc: String(f.description).slice(0, 150), image: f.image,
    body: html`${pageHead(f.title, `A fundraiser supporting the ${org.name}`)}
<section class="section"><div class="wrap two top"><div>${f.image ? html`<img class="cover" src="${f.image}" alt="" loading="lazy">` : ""}${paragraphs(f.description)}</div>
<aside class="card">${progress(f.raised, f.target_amount, f.currency)}${f.deadline ? html`<p>Ends ${fdate(f.deadline)}</p>` : ""}
<a class="btn btn-gold" href="/donate?fundraiser=${f.slug}">Donate to this fundraiser</a></aside></div></section>` });
}

// ---------------- PROJECTS ----------------
function projects(ctx, list) {
  return layout(ctx, { title: "Projects", desc: "Our programmes for children: education support, basic needs, child wellbeing and community development.",
    body: html`${pageHead("Our projects", "We are honest about the stage each programme is at.")}
<section class="section"><div class="wrap grid2">${list.map((p) => html`<article class="card project">
${p.image ? html`<img src="${p.image}" alt="" loading="lazy" width="800" height="450">` : ""}
<span class="badge ${p.status}">${STATUS[p.status]}</span><h2>${p.title}</h2><p>${p.description || p.summary}</p>
${p.goals ? html`<h3>Goals</h3><ul>${String(p.goals).split("\n").filter(Boolean).map((g) => html`<li>${g}</li>`)}</ul>` : ""}</article>`)}</div></section>` });
}

// ---------------- NEWS ----------------
function news(ctx, posts, cat, cats) {
  return layout(ctx, { title: "News", desc: "Updates from the Rosa Lomba Da Silva Foundation.",
    body: html`${pageHead("News and updates", "Follow our early journey.")}
<section class="section"><div class="wrap">${cats.length ? html`<p class="tags"><a href="/news" ${!cat ? raw('aria-current="true"') : ""}>All</a>${cats.map((c) => html`<a href="/news?category=${encodeURIComponent(c)}" ${cat === c ? raw('aria-current="true"') : ""}>${c}</a>`)}</p>` : ""}
${posts.length ? html`<div class="grid3">${posts.map((p) => html`<article class="card post">${p.image ? html`<img src="${p.image}" alt="" loading="lazy" width="600" height="340">` : ""}
<p class="meta">${fdate(p.published_at)}${p.category ? html` &middot; ${p.category}` : ""}</p><h2><a href="/news/${p.slug}">${p.title}</a></h2><p>${p.excerpt}</p></article>`)}</div>`
  : html`<p class="lead">Our first stories are coming soon.</p>`}</div></section>` });
}
function post(ctx, p) {
  return layout(ctx, { title: p.meta_title || p.title, desc: p.meta_description || p.excerpt || p.title, image: p.image,
    jsonld: { "@context": "https://schema.org", "@type": "Article", headline: p.title, datePublished: p.published_at, author: { "@type": "Person", name: p.author || org.name }, ...(p.image ? { image: cfg.siteUrl + p.image } : {}) },
    body: html`${pageHead(p.title, `${fdate(p.published_at)}${p.author ? " by " + p.author : ""}`)}
<article class="section"><div class="wrap narrow prose">${p.image ? html`<img class="cover" src="${p.image}" alt="" width="1200" height="630">` : ""}${paragraphs(p.body)}<p><a class="link" href="/news">Back to news</a></p></div></article>` });
}

// ---------------- GALLERY ----------------
function gallery(ctx, items, albums, album) {
  return layout(ctx, { title: "Gallery", desc: "Photos from the Rosa Lomba Da Silva Foundation.",
    body: html`${pageHead("Gallery", "Moments from our early days.")}
<section class="section"><div class="wrap">${albums.length > 1 ? html`<p class="tags"><a href="/gallery" ${!album ? raw('aria-current="true"') : ""}>All</a>${albums.map((a) => html`<a href="/gallery?album=${encodeURIComponent(a)}" ${album === a ? raw('aria-current="true"') : ""}>${a}</a>`)}</p>` : ""}
<div class="masonry">${items.map((g) => html`<figure><img src="${g.image}" alt="${g.alt_text || g.caption || ""}" loading="lazy" width="800" height="600">${g.caption ? html`<figcaption>${g.caption}</figcaption>` : ""}</figure>`)}</div></div></section>` });
}

// ---------------- TRANSPARENCY ----------------
function transparency(ctx, d) {
  return layout(ctx, { title: "Transparency", desc: "How donations will be used, and where to find our reports and project updates.",
    body: html`${pageHead("Transparency", "Donors deserve to see where their money goes.")}
<section class="section"><div class="wrap two top"><div><h2>How donations will be used</h2>
<p>Every donation will be recorded and receipted. We commit to using gifts for children's programmes first, keeping running costs lean, and reporting openly.</p>
<ul class="ticks"><li>Direct support for children: education, basic needs and wellbeing</li><li>Programme delivery and community work</li><li>Essential running costs and payment fees</li></ul>
<p>Percentage targets for each area will be published here once approved by our leadership.</p></div>
<div class="card tint-card"><h2>Financial position</h2>${d.stats.count > 0
  ? html`<p>Completed donations recorded so far: <strong>${d.stats.count}</strong>.</p><p>Total received: <strong>${d.stats.totals.map((t) => money(t.total, t.currency)).join(", ")}</strong></p>`
  : html`<p>We are at the very beginning. We have not yet received external donations, and we will show real totals here as soon as we do.</p>`}</div></div></section>
<section class="section tint"><div class="wrap"><h2>Reports and documents</h2>
${d.reports.length ? html`<ul class="docs">${d.reports.map((r) => html`<li><a href="${r.file}" target="_blank" rel="noopener">${r.title}</a><span>${r.report_type}${r.period ? " · " + r.period : ""}</span>${r.description ? html`<p>${r.description}</p>` : ""}</li>`)}</ul>`
  : html`<p>Our first financial and project reports will be published here as soon as we have them.</p>`}</div></section>
<section class="section"><div class="wrap"><h2>Project updates</h2>${d.posts.length ? html`<ul class="docs">${d.posts.map((p) => html`<li><a href="/news/${p.slug}">${p.title}</a><span>${fdate(p.published_at)}</span></li>`)}</ul>` : html`<p>Updates will appear here and on our <a href="/news">news page</a>.</p>`}</div></section>` });
}

// ---------------- CONTACT ----------------
function contact(ctx, form = {}, error = "", done = false) {
  const v = (k) => form[k] ?? "";
  const social = Object.entries(org.social).filter(([, u]) => u);
  return layout(ctx, { title: "Contact", desc: "Get in touch with the Rosa Lomba Da Silva Foundation.",
    body: html`${pageHead("Contact us", "Questions, ideas or partnership proposals are all welcome.")}
<section class="section"><div class="wrap two top">
<div>${done ? html`<p class="notice ok" role="status">Thank you. We have received your message.</p>` : html`
<form class="form card" method="post" action="/contact">${csrf(ctx)}${trap}${errBox(error)}
<label for="name">Name</label><input id="name" name="name" required autocomplete="name" value="${v("name")}">
<label for="email">Email</label><input id="email" type="email" name="email" required autocomplete="email" value="${v("email")}">
<label for="subject">Subject</label><input id="subject" name="subject" value="${v("subject")}">
<label for="message">Message</label><textarea id="message" name="message" rows="6" required>${v("message")}</textarea>
<button class="btn btn-green" type="submit">Send message</button></form>`}</div>
<aside class="card"><h2>Details</h2>
${org.email ? html`<p>Email: <a href="mailto:${org.email}">${org.email}</a></p>` : ""}${org.phone ? html`<p>Phone: ${org.phone}</p>` : ""}${org.location ? html`<p>Location: ${org.location}</p>` : ""}
${!org.email && !org.phone && !org.location ? html`<p>Use the form and we will reply as soon as we can.</p>` : ""}
${social.length ? html`<p>${social.map(([n, u]) => html`<a href="${u}" rel="noopener" target="_blank">${n}</a> `)}</p>` : ""}</aside></div></section>` });
}

function notFound(ctx) {
  return layout(ctx, { title: "Page not found", desc: "Page not found", noindex: true, body: html`${pageHead("Page not found", "That page does not exist or has moved.")}<section class="section"><div class="wrap narrow"><p><a class="btn btn-green" href="/">Go to the home page</a></p></div></section>` });
}
module.exports = { layout, home, about, donate, donateInstructions, receipt, volunteer, fundraise, fundraiser, projects, news, post, gallery, transparency, contact, notFound, STATUS };
