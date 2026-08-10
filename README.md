# Occupational therapy practice — website

Static site. No build step, no framework, no JavaScript, no external requests.

## Deploy to Cloudflare

Deployed as a **Worker with static assets**, not Cloudflare Pages. The site is
`public/`; everything outside it — this README, `wrangler.toml`, `.gitignore` —
is not uploaded and is never served.

There is no build step. `wrangler.toml` supplies the whole configuration, so
in Workers Builds the build command stays **empty** and the deploy command is
the default:

```
npx wrangler deploy
```

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Workers**
2. **Connect to Git** → select this repository
3. Leave the build command empty; deploy command `npx wrangler deploy`
4. **Custom domains** → add your domain, follow the DNS instructions
5. **SSL/TLS** → set encryption mode to **Full (strict)**

Every push to the production branch redeploys automatically. The same
`npx wrangler deploy` publishes from a terminal without connecting Git.

Note `wrangler pages deploy` is **not** the right command for this repo — that
is the Pages path, and it will not read the `[assets]` configuration.

## Before going live

The site is **not ready to publish as-is.** Replace every `[BRACKETED]`
placeholder across `public/` — `index.html`, `privacy.html`, `terms.html`,
`404.html`, `robots.txt` and `sitemap.xml`. Do it in one pass.

| Placeholder | Replace with |
|---|---|
| `[YOUR NAME]` | Name referrers will use |
| `[YOUR FULL LEGAL NAME]` | Exactly as on the AHPRA register |
| `[YOUR EMAIL]` | Domain email address |
| `[YOUR PHONE]` | Display format, e.g. `04XX XXX XXX` |
| `[YOURPHONE_NO_SPACES]` | Dial format, e.g. `+61400000000` |
| `[YOURDOMAIN]` | Domain without `www` |
| `[OTA0000000000]` | AHPRA registration number |
| `[00 000 000 000]` | ABN |
| `[DEGREE]`, `[UNIVERSITY]`, `[YEAR]` | Qualification |
| `[LOCATION]` | Suburb, not full street address |
| `[SUPERVISOR NAME]`, `[PROFESSION]` | Clinical supervisor |
| `[NUMBER]` | WWCC and NDIS worker screening numbers |
| `[XXX]`, `[50]`, `[60]`, `[4–6]`, `[2]`, `[24 / 48]` | Fees, durations, response and cancellation windows |
| `[DATE]` | Date the legal pages were last updated |
| `[HOURS]` | Consulting hours, e.g. `Tue–Fri, 9am–4pm` |
| `[AVAILABILITY]` | Current books, e.g. `Currently accepting new clients` or `Waitlist from March`. Keep this true — it sits next to the main call to action |
| `[XX]` | Percentage of the fee charged for a late cancellation (`terms.html`) |
| `[NEAREST STATION]` | Nearest station or stop, for the Getting here block |
| `[PARKING NOTE]` | One sentence on parking, or delete the placeholder |
| `[MAPS_QUERY]` | URL-encoded address for the directions link, e.g. `12+Example+St+Newtown+NSW` |

Find remaining placeholders before deploying:

```
grep -ro '\[[A-Za-z0-9 /–_]*\]' public/ | sort -u
```

`[YOURDOMAIN]` appears in the canonical link, `robots.txt` and `sitemap.xml`;
all three must end up as the same hostname you attach in **Custom domains**.

## Files

| File | Purpose |
|---|---|
| `public/index.html` | The site — one page |
| `public/privacy.html` | Privacy policy (required — health information is handled) |
| `public/terms.html` | Terms of service, scope and no-guarantee clauses |
| `public/404.html` | Not-found page |
| `public/styles.css` | All styling, light and dark modes |
| `public/_headers` | Cloudflare security headers — **do not rename** |
| `public/thank-you.html` | Post-enquiry landing page (see below) |
| `public/robots.txt` | Search engine directives |
| `public/sitemap.xml` | The three indexable pages |
| `public/favicon.svg` | Browser tab icon, light and dark variants |
| `public/share.png` | 1200×630 social preview image |
| `wrangler.toml` | Worker name, asset directory, 404 handling |

## Search, structured data and sharing

Every page carries a unique `<title>`, a unique meta description, a canonical
URL and Open Graph tags. `share.png` is the social preview; it deliberately
contains no `[BRACKETED]` text, so it does not need regenerating when you fill
the placeholders in.

`index.html` embeds JSON-LD for `MedicalBusiness`, `Person`, `WebSite` and
`FAQPage`. The legal pages and `thank-you.html` carry `BreadcrumbList`.

JSON-LD is a `<script type="application/ld+json">` **data block**. Browsers
never execute it, so it is not subject to the `script-src 'none'` policy in
`_headers`. This is the one and only kind of `<script>` tag that belongs in
this site — do not add any other.

**Never add `Review` or `AggregateRating` to the structured data.** See the
compliance note below.

## Analytics

There is no Google Analytics, and it should not be added. It would require
loosening `script-src` away from `'none'`, load third-party JavaScript,
introduce cookies, and send visitor data — including the fact that someone
visited a health service — to a third party. It would also directly contradict
what `privacy.html` currently tells visitors.

Use **Cloudflare Web Analytics** instead: Cloudflare dashboard → **Analytics**.
Because the site is served by Cloudflare, request analytics are collected
server-side with **no client-side script at all**, so the CSP, the zero-external-
requests property and the privacy policy all stay true. You get page views,
referrers, paths and countries without a tracking beacon.

If you later need conversion tracking, the honest way is a real form posting to
your own endpoint plus `thank-you.html` as its success page — not a pixel.

## The thank-you page

`thank-you.html` exists and is `noindex`, but nothing links to it yet, because
the site has no form. It is there for two uses:

- as the success page if you later add a real enquiry form
- as a link in an email autoresponder, so people who email get a page setting
  out response time and next steps

Until one of those exists it is unreachable, which is intentional rather than
an oversight.

## Adding your photo

There is no portrait on the site. A real photograph of you is the single
highest-value addition to a solo health practice page — people are choosing a
person, not a service. Add it inside the **Qualifications and registration**
section of `index.html`, immediately after the opening `<div>` of the second
column:

```html
<img class="portrait" src="/portrait.jpg" width="440" height="560"
     alt="[YOUR NAME], occupational therapist">
```

Save the file as `public/portrait.jpg`, around 880×1120 for a sharp result on
retina screens, under about 200 KB. The `alt` text should be your name and
role — not "photo of" or "headshot", which screen readers already announce.

Keep it a real photo. A stock image on a health practice page is both obvious
and, because it misrepresents the practitioner, a problem under the advertising
guidelines.

## Design decisions

**No JavaScript.** The content security policy sets `script-src 'none'`, so there
is no script execution path at all. All motion is CSS.

**No external requests.** System fonts only — no Google Fonts, which would leak
visitor IP addresses to a third party. No analytics, no cookies, no pixels, no
embedded widgets. Nothing loads from another server.

**No contact form.** Enquiries arrive as ordinary email. Nothing is collected,
stored or processed by the site, so there is no visitor data to breach.

**Motion is confined to one orchestrated moment** — the hero graphic drawing
itself on load. Nothing animates on scroll. `prefers-reduced-motion: reduce`
disables all of it and renders the final state immediately.

**Light and dark modes** follow the system setting via
`prefers-color-scheme`. `prefers-contrast: more` is also honoured.

## Accessibility

- Skip link on every page
- Landmarks and a real heading hierarchy
- Hero graphic carries `role="img"` with `<title>` and `<desc>`
- Visible focus rings throughout
- WCAG AA contrast in both colour modes
- Reduced motion fully respected

## Compliance note

Copy on this site is written to comply with section 133 of the Health
Practitioner Regulation National Law and the AHPRA advertising guidelines.
It contains no testimonials, no outcome claims, no guarantees and no
comparative superiority claims. Review any change against those guidelines
before publishing — the test is the overall impression created, not whether
each individual sentence is defensible.

**Do not add reviews or testimonials.** Section 133 prohibits the use of
testimonials in advertising a regulated health service. This covers patient
reviews quoted on the site, star ratings, `Review`/`AggregateRating` structured
data, and embedded review widgets. It applies to genuine reviews as well as
solicited ones — truth is not a defence here. Reviews visitors leave on
third-party platforms of their own accord are outside your control and are not
the issue; reproducing them on your own site is.

The **What the work looks like** section is written to stay clear of the same
rule. The three examples are composites, labelled as such on the page, and
describe what the work involves rather than what it achieved. If you replace
them with anything drawn from real clients you need informed consent, thorough
de-identification, and no outcome or satisfaction claim — at which point it is
usually simpler to keep them as composites.
