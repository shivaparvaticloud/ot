# Simple Occupational Therapy — website

Static multi-page site. No build step, no framework, no JavaScript, no external
requests, no cookies, no contact form.

## Deploy to Cloudflare

Deployed as a **Worker with static assets**. The site is `public/`; everything
outside it — this README, `wrangler.toml`, `.gitignore` — is not uploaded and
is never served.

There is no build step. `wrangler.toml` supplies the configuration, so in
Workers Builds the build command stays **empty** and the deploy command is the
default:

```
npx wrangler deploy
```

Every push to the production branch redeploys automatically.

Note `wrangler pages deploy` is **not** the right command for this repo — that
is the Pages path, and it will not read the `[assets]` configuration.

## Confirm before launch

**The domain is assumed to be `simpletherapy.com.au`.** That was inferred from
the enquiry subdomain `contact.simpletherapy.com.au`. It appears in every
canonical URL, Open Graph tag, `sitemap.xml`, `robots.txt`, `llms.txt` and the
JSON-LD. If the site actually lives somewhere else, search and replace
`simpletherapy.com.au` across `public/` before launch.

Enquiries all point at `https://contact.simpletherapy.com.au`. There is no
email address, phone number or street address anywhere on the site.

## Pages

| File | Purpose |
|---|---|
| `public/index.html` | Home — hero, the demand/capacity graphic, links to everything |
| `public/what-is-ot.html` | What occupational therapy is, what it addresses, what it is not |
| `public/who-i-help.html` | Who the practice sees, and three illustrative examples |
| `public/approach.html` | The clinical frameworks the reasoning rests on |
| `public/how-it-works.html` | Six-step process, sessions, fees, funding |
| `public/faqs.html` | Seven common questions |
| `public/about.html` | The practitioner, why the practice runs this way |
| `public/contact.html` | Points at the enquiry form |
| `public/privacy.html` | Privacy policy (required — health information is handled) |
| `public/terms.html` | Terms of service, scope and no-guarantee clauses |
| `public/404.html` | Not-found page |

## Supporting files

| File | Purpose |
|---|---|
| `public/styles.css` | All styling, light and dark modes |
| `public/_headers` | Cloudflare security headers — **do not rename** |
| `public/robots.txt` | Search and AI crawler directives |
| `public/sitemap.xml` | All ten indexable pages |
| `public/llms.txt` | Plain-text practice summary for AI assistants |
| `public/favicon.svg` | Browser tab icon, light and dark variants |
| `public/share.png` | 1200×630 social preview image |
| `public/.well-known/security.txt` | Vulnerability reporting contact (RFC 9116) |
| `wrangler.toml` | Worker name, asset directory, 404 handling |

Links use explicit `.html` extensions. That works under every Cloudflare
`html_handling` mode. If you want extensionless URLs later, `html_handling`
defaults to `auto-trailing-slash`, which serves `/about` from `about.html` —
change the links and test one before changing them all.

## Editing the shared header and footer

There is no build step and no templating, so the masthead, nav and footer are
duplicated across all eleven pages. **A nav change means editing eleven
files.** That is the trade-off for a site with no build tooling; a find and
replace across `public/*.html` handles it. Do not add a build step just for
this unless the page count grows a lot.

## Before going live

Replace every `[BRACKETED]` placeholder across `public/`. Find them with:

```
grep -ro '\[[A-Za-z0-9 /–_]*\]' public/ | sort -u
```

| Placeholder | Replace with |
|---|---|
| `[YOUR NAME]` | The practitioner's name — the only personal detail on the site |
| `[AVAILABILITY]` | Current books, e.g. `Currently accepting new clients` or `Waitlist from March`. Keep this true — it sits beside the main call to action |
| `[2]` | Response time in business days |
| `[XXX]` | Session fees |
| `[50]`, `[60]` | Session lengths in minutes |
| `[4–6]` | Typical block length |
| `[24 / 48]` | Cancellation notice window |
| `[XX]` | Percentage of the fee charged for a late cancellation (`terms.html`) |
| `[at the time of the appointment / within 7 days of invoice]` | Payment terms — pick one |
| `[DATE]` | Date the legal pages were last updated |
| `[SECURITY_TXT_EXPIRY]` | ISO timestamp under a year away, e.g. `2027-06-30T00:00:00.000Z`. RFC 9116 requires it; diarise renewing it |

## What is deliberately not on this site

Only the practitioner's name appears as a personal detail. No AHPRA
registration number, no qualifications, no ABN, no phone number, no email
address, no street address, no photograph.

Two consequences worth being aware of, neither of which is a defect:

**Verification is harder for referrers.** Publishing an AHPRA number is not
required by the National Law or the advertising guidelines, so omitting it is
compliant. But a GP or support coordinator checking credentials now has to
search the public register by name. `about.html` points them there explicitly,
which is the honest substitute.

**Local search is weakened.** Google Maps and Apple Maps rank on a verified
address, and the JSON-LD no longer carries `address`, `geo`, `hasMap` or
opening hours, because publishing those would contradict the brief. If local
visibility matters later, the fix is a **service-area business** listing in
Google Business Profile — it lets you serve a region without displaying a
street address. That is an off-site change; the site does not need editing for
it.

## Confirm the approach page before publishing

`approach.html` names five frameworks: Person–Environment–Occupation, the Model
of Human Occupation, a sensory processing framework, CO-OP, and goal
measurement in the client's own words.

These are mainstream adult occupational therapy models, chosen because they are
widely taught and likely to match the practice — but they are a placeholder in
substance even though they contain no brackets. **Read the five and delete or
replace any that do not reflect how you actually work.** Claiming a framework
you do not use is a misleading advertising claim.

## Search, structured data and sharing

Every page carries a unique `<title>`, a unique meta description, a canonical
URL, Open Graph tags and a breadcrumb trail. `share.png` is the social preview
and contains no `[BRACKETED]` text, so it does not need regenerating.

`index.html` embeds JSON-LD for `MedicalBusiness`, `Person` and `WebSite`.
`faqs.html` carries `FAQPage`. Every subpage carries `BreadcrumbList`.

JSON-LD is a `<script type="application/ld+json">` **data block**. Browsers
never execute it, so it is not subject to `script-src 'none'`. This is the one
and only kind of `<script>` tag that belongs in this site.

**Never add `Review` or `AggregateRating`.** See the compliance note below.

`robots.txt` explicitly allows the major AI crawlers — GPTBot, OAI-SearchBot,
ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Google-Extended and
Applebot. Several hosts block these by default, which quietly removes a
practice from assistant answers. Nothing is disallowed.

`llms.txt` is a plain-text summary for assistants: who the practice sees, what
it addresses, funding, scope and limits, plus an instruction not to synthesise
reviews.

## Analytics

There is no Google Analytics, and it should not be added. It would require
loosening `script-src` away from `'none'`, load third-party JavaScript,
introduce cookies, and send visitor data — including the fact that someone
visited a health service — to a third party. It would also contradict what
`privacy.html` tells visitors.

Use **Cloudflare Web Analytics** instead: dashboard → **Analytics**. Because
the site is served by Cloudflare, request analytics are collected server-side
with **no client-side script at all**, so the CSP, the zero-external-requests
property and the privacy policy all stay true.

## Security

The site has no JavaScript, no forms, no cookies, no database and no backend,
so most of the usual attack surface does not exist. The headers in `_headers`
exist to keep it that way: if a future edit tries to pull in an external
script, font, frame or tracker, the browser refuses it rather than failing
silently.

`Content-Security-Policy` names every directive explicitly rather than relying
on `default-src` fallback, so `script-src`, `connect-src`, `media-src`,
`object-src`, `frame-src`, `child-src` and `worker-src` are all `'none'`. Also
set: HSTS, `nosniff`, `X-Frame-Options`, `X-Permitted-Cross-Domain-Policies`, a
restrictive `Referrer-Policy`, the three Cross-Origin isolation headers
(COOP/CORP/COEP), and a `Permissions-Policy` that switches off every feature
the site does not use.

**One thing to decide before launch:** the HSTS header includes `preload`. That
is only a commitment once you submit the domain at hstspreload.org, but it is a
real one — every subdomain becomes HTTPS-only in shipped browsers, and removal
takes months. Note this would include `contact.simpletherapy.com.au`, so
confirm the enquiry form is HTTPS-only before submitting.

## Design decisions

**No JavaScript.** The content security policy sets `script-src 'none'`, so
there is no script execution path at all. All motion is CSS.

**No external requests.** System fonts only — no Google Fonts, which would leak
visitor IP addresses to a third party. No analytics, no cookies, no pixels, no
embedded widgets. Nothing loads from another server.

**No contact form on this site.** Enquiries go to a separate secure form, so
this site collects nothing and there is no visitor data here to breach.

**Motion is confined to one orchestrated moment** — the hero graphic drawing
itself on load, on the home page only. Nothing animates on scroll.
`prefers-reduced-motion: reduce` disables all of it and renders the final state
immediately.

**Light and dark modes** follow the system setting via `prefers-color-scheme`.
`prefers-contrast: more` is also honoured.

**Separate pages rather than one long scroll.** Each question a visitor might
have has its own URL, which is better for search, for sharing a specific
answer, and for anyone who finds a long page hard to navigate.

## Accessibility

- Skip link on every page
- Landmarks, breadcrumbs and a real heading hierarchy — one `h1` per page
- Hero graphic carries `role="img"` with `<title>` and `<desc>`
- Visible focus rings throughout
- WCAG AA contrast in both colour modes, measured rather than assumed. The
  tightest pair is `--ink-faint` on `--paper-deep`: 4.62:1 light, 4.81:1 dark,
  against a 4.5:1 floor. Re-check with a contrast tool if you change the
  palette — the small uppercase labels are the first thing to fail.
- Reduced motion fully respected

## Compliance note

Copy on this site is written to comply with section 133 of the Health
Practitioner Regulation National Law and the AHPRA advertising guidelines. It
contains no testimonials, no outcome claims, no guarantees and no comparative
superiority claims. Review any change against those guidelines before
publishing — the test is the overall impression created, not whether each
individual sentence is defensible.

**Do not add reviews or testimonials.** Section 133 prohibits the use of
testimonials in advertising a regulated health service. This covers patient
reviews quoted on the site, star ratings, `Review`/`AggregateRating` structured
data, and embedded review widgets. It applies to genuine reviews as well as
solicited ones — truth is not a defence here. Reviews visitors leave on
third-party platforms of their own accord are outside your control and are not
the issue; reproducing them on your own site is.

The **What the work looks like** examples on `who-i-help.html` are written to
stay clear of the same rule. They are composites, labelled as such on the page,
and describe what the work involves rather than what it achieved. If you
replace them with anything drawn from real clients you need informed consent,
thorough de-identification, and no outcome or satisfaction claim — at which
point it is usually simpler to keep them as composites.
