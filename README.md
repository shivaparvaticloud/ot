# Simple Roots Therapy — website

Static multi-page site. No build step, no framework, no JavaScript, no external
requests, no cookies, no contact form.

Built from two source documents: **Web Map.docx** (structure and copy) and
**Brand Kit.docx** (voice, colour, typography).

## Deploy to Cloudflare

Deployed as a **Worker with static assets**. The site is `public/`; everything
outside it — this README, `wrangler.toml`, `.gitignore` — is not uploaded and
is never served. There is no build step, so in Workers Builds the build command
stays **empty** and the deploy command is the default:

```
npx wrangler deploy
```

Note `wrangler pages deploy` is **not** the right command for this repo — that
is the Pages path, and it will not read the `[assets]` configuration.

## Confirm before launch

**The domain is assumed to be `simplerootstherapy.com.au`,** taken from the
email address in the Web Map. It appears in every canonical URL, Open Graph
tag, `sitemap.xml`, `robots.txt`, `llms.txt`, `security.txt` and the JSON-LD.
If the site lives elsewhere, search and replace across `public/`.

## Pages

Per the Web Map, plus an FAQs page (its questions were in the Web Map but
without a home of their own).

| File | Purpose |
|---|---|
| `public/index.html` | Home — tagline, what we believe, the three simple roots |
| `public/about.html` | Meet your therapist, clinical interests, approach, values |
| `public/services.html` | What OT is, paediatric, adult and adolescent, group programs |
| `public/sessions-and-fees.html` | Six-step process, session types, delivery modes, funding |
| `public/faqs.html` | Seven questions |
| `public/contact.html` | Contact us |
| `public/privacy.html` | Privacy policy (required — health information is handled) |
| `public/terms.html` | Terms of service, scope and no-guarantee clauses |
| `public/404.html` | Not-found page |

Supporting files: `styles.css`, `_headers`, `robots.txt`, `sitemap.xml`,
`llms.txt`, `favicon.svg`, `share.png`, `.well-known/security.txt`.

## Brand kit implementation

**The site is dark for every visitor.** There is no light palette and no
`prefers-color-scheme` switch — a visitor whose system is set to light still
gets the dark site. `color-scheme: dark` is declared so scrollbars and any
native controls match.

**Colour.** The brand kit specifies a light scheme only, so the kit is followed
in *role and relationship* rather than literal hex. Its five colours are kept
in `styles.css` as reference constants, and the applied roles are the dark
treatment derived from them, on the kit's 60 / 20 / 10 / 10 split:

| Kit role | Kit colour | Applied (dark) | Where |
|---|---|---|---|
| Background Neutral | Bright Snow `#F4F7F6` | `#1C242A` | Page background, ~60% |
| Warm Neutral | Soft Linen `#EAE7E1` | `#232D34` | Alternating bands, cards, ~20% |
| Primary Dark | Jet Black `#2B3A42` | `#EDF1F0` | Headings — the role inverts |
| Secondary | Air Force Blue `#628294` | `#8FAEC0` | Diagram strokes, rules, icons |
| Accent | Smoky Rose `#825358` | `#D49AA0` | Buttons, links, active states, ~10% |

The kit's muted-hierarchy rule is preserved: headings, body and captions step
down in three levels (`#EDF1F0`, `#DBE2E1`, `#9BA6AB`) and pure white is never
used, exactly as pure black was never used in the light version.

Two things to know about the colour:

1. **Air Force Blue is not used for text**, in either treatment. In the kit's
   own light scheme it measures **3.79:1** on Bright Snow, below the 4.5:1 AA
   floor. It clears 3:1 for graphics, so it drives diagram strokes, rules and
   icons — consistent with the kit's "key structural elements" — and never
   small text or a button fill.
2. **Every dark pair was measured, not assumed.** Tightest is 5.64:1 against a
   4.5:1 floor. If the kit is later extended with an official dark palette,
   replace these values and re-measure.

`share.png` and `favicon.svg` use the same dark treatment. The favicon has a
single mid-tone version rather than a light/dark pair, because it needs to stay
legible against the browser's chrome, not the site's background.

**Typography.** Sans title / serif story, as specified:

- **Sans** (headings, UI labels, buttons): the kit's picks — Inter, Open Sans,
  Aptos, Frutiger — then the system UI face.
- **Serif** (body and narrative): Georgia first, the kit's own first choice,
  then Source Serif Pro and Freight Text.

**No webfonts are loaded.** Downloading one would break the zero-external-
requests property and leak visitor IPs to a font host, which for a health
service is a real cost. Georgia is near-universal, so the serif renders as
specified almost everywhere; the sans falls back to the system UI face, which
is itself a humanist sans in the same family of shapes.

Scale follows the kit's ratios on a 16px base: H1 at 48–56px with `-0.02em`
tracking and 1.1 line-height, serif lead at 21px, eyebrows at 12px uppercase
with wide tracking, section labels uppercase with `+0.08em`, buttons 15px sans.
Body line-height is set to 1.5 — the top of the kit's 1.4–1.5 range, and the
WCAG minimum for body text.

**Voice.** Warm, professional, clear. "We", "you" and "your"; the therapist is
referred to in the third person as Crystal. First-person "I" does not appear
anywhere in the site's own voice. The FAQ questions are phrased in the
visitor's voice ("Do I need a referral?"), which is the visitor speaking, not
the practice.

## What was inferred, and needs checking

- **The process has six steps; the Web Map gave only "Step 2: Free 10-minute
  phone call".** Steps 1 and 3–6 (enquiry, initial assessment, findings and
  goals, ongoing sessions, review) were written to fit around it. Read them and
  correct anything that does not match how the practice actually runs.
- **Delivery modes** were listed in the Web Map without detail. Clinic, home,
  school/preschool and telehealth are listed on the sessions page — remove any
  that are not offered.
- **Group programs** were named without copy. A short section is on the
  services page.
- **The Web Map asks for a contact form** ("or complete the form below"). There
  is no form: this site has no JavaScript and no backend, and the CSP sets
  `form-action 'none'`. Email is the contact route for now. A working form
  needs a third-party endpoint or a small Worker, which would mean relaxing the
  CSP — worth deciding deliberately rather than by default.

## Advertising compliance — read this before publishing

Copy is written to comply with section 133 of the Health Practitioner
Regulation National Law and the AHPRA advertising guidelines. It contains no
testimonials, no outcome claims, no guarantees and no comparative superiority
claims.

**Do not add reviews or testimonials.** Section 133 prohibits testimonials in
advertising a regulated health service. That covers quoted reviews, star
ratings, `Review`/`AggregateRating` structured data and review widgets, and it
applies to genuine reviews as much as solicited ones.

**The meditation and Pranic Healing lines need a decision.** The About page
states, as the Web Map does, that Crystal is a certified Meditation Teacher and
Pranic Healer. As a biographical fact about the practitioner that is generally
fine. It becomes a problem if it reads as part of the clinical offering, or if
any therapeutic benefit is claimed for it — AHPRA takes a firm line where a
registered practitioner's advertising blends regulated care with modalities
that have no accepted evidence base. It currently sits under "Beyond the
clinic", deliberately separated from the services page. Keep that separation,
and do not add efficacy claims.

The **terms of service** carries a "coaching and non-clinical offerings" clause
saying which service you are receiving will be stated up front. That matters
because the practice offers coaching and mentoring alongside registered OT, and
the two are funded and regulated differently.

## Before going live

```
grep -ro '\[[A-Za-z0-9 /–_]*\]' public/ | sort -u
```

| Placeholder | Replace with |
|---|---|
| `[2]` | Response time in business days |
| `[24 / 48]` | Cancellation notice window |
| `[at the time of the appointment / within 7 days of invoice]` | Payment terms — pick one |
| `[DATE]` | Date the legal pages were last updated |
| `[SECURITY_TXT_EXPIRY]` | ISO timestamp under a year away, e.g. `2027-06-30T00:00:00.000Z` |

## No fees are published

By instruction, the site carries **no dollar amounts, no session lengths in
minutes and no price indicators** — `priceRange` has been removed from the
structured data too, since `$$` is still a price signal. The sessions page
describes what each session type *is*, and says fees are discussed during the
free ten-minute call and confirmed in writing before the first appointment.
`llms.txt` tells AI assistants the same thing and asks them not to quote a
figure.

Cancellation terms say "charged in full" rather than a percentage, for the
same reason. NDIS wording refers to the current NDIS Pricing Arrangements
without reproducing any rate.

If you later want to publish fees, the sessions page is the place, and the
`llms.txt` funding note needs updating at the same time or the two will
disagree.

## Contact opens the visitor's mail client

Every call to action — hero button, sticky mobile bar, the contact page
button, the group-program link, the end-of-page links — is a
`mailto:contact@simplerootstherapy.com.au?subject=Enquiry` link. Clicking one
opens whatever mail client the visitor has set as default: Outlook, Apple Mail,
Thunderbird, or Gmail where the browser is configured to handle `mailto:`.

Worth knowing: **`mailto:` opens the default handler, and on desktop that is
not Gmail unless the visitor has set it.** Someone using webmail without that
handler registered may see nothing happen, or an unconfigured mail app open.
The address is also shown as plain visible text in the footer and on the
contact page, so it can always be copied by hand — which is the fallback that
makes this safe.

The Web Map asked for a contact form. There is none: this site has no
JavaScript and no backend, and the CSP sets `form-action 'none'`. A real form
would need a third-party endpoint or a small Worker, and a CSP change.

## Location

The site says **Sydney**, and telehealth across NSW, with no suburb, street
address, map or coordinates anywhere. That is deliberate for now. When you want
to be specific, the places to update are the masthead tagline, the contact
page's "Serving" line, `llms.txt`, and the `areaServed` block in the home page
JSON-LD — at which point adding `address` and `geo` to that schema is what
makes the practice eligible for Maps results.

## Editing the shared header and footer

There is no build step and no templating, so the masthead, nav and footer are
duplicated across all nine pages. **A nav change means editing nine files.**
That is the trade-off for a site with no build tooling; a find and replace
across `public/*.html` handles it.

## Search, structured data and sharing

Every page carries a unique `<title>`, a unique meta description, a canonical
URL, Open Graph tags and a breadcrumb trail. `share.png` is the social preview.

`index.html` embeds JSON-LD for `MedicalBusiness`, `Person` and `WebSite`.
`faqs.html` carries `FAQPage`. Every subpage carries `BreadcrumbList`.

JSON-LD is a `<script type="application/ld+json">` **data block**. Browsers
never execute it, so it is not subject to `script-src 'none'`. This is the one
and only kind of `<script>` tag that belongs in this site.

`robots.txt` explicitly allows the major AI crawlers — GPTBot, OAI-SearchBot,
ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot, Google-Extended and
Applebot. Several hosts block these by default, which quietly removes a
practice from assistant answers. Nothing is disallowed.

`llms.txt` is a plain-text summary for assistants, including an instruction not
to synthesise reviews.

**Off-site, and worth more than any of the above:** claim the **Google Business
Profile** and **Apple Business Connect** listings. Maps results come from
those, not from this site. There is no street address on the site, so register
as a **service-area business**, which serves a region without displaying an
address.

## Analytics

There is no Google Analytics, and it should not be added. It would require
loosening `script-src` away from `'none'`, load third-party JavaScript,
introduce cookies, and send visitor data — including the fact that someone
visited a health service — to a third party. It would also contradict what
`privacy.html` tells visitors.

Use **Cloudflare Web Analytics** instead: dashboard → **Analytics**. Because
the site is served by Cloudflare, request analytics are collected server-side
with **no client-side script at all**.

## Security

The site has no JavaScript, no forms, no cookies, no database and no backend,
so most of the usual attack surface does not exist. The headers in `_headers`
keep it that way: if a future edit pulls in an external script, font, frame or
tracker, the browser refuses it rather than failing silently.

`Content-Security-Policy` names every directive explicitly rather than relying
on `default-src` fallback, so `script-src`, `connect-src`, `media-src`,
`object-src`, `frame-src`, `child-src` and `worker-src` are all `'none'`. Also
set: HSTS, `nosniff`, `X-Frame-Options`, `X-Permitted-Cross-Domain-Policies`, a
restrictive `Referrer-Policy`, the three Cross-Origin isolation headers
(COOP/CORP/COEP), and a `Permissions-Policy` that switches off every feature
the site does not use.

**Decide before launch:** the HSTS header includes `preload`. That is only a
commitment once you submit at hstspreload.org, but it is a real one — every
subdomain becomes HTTPS-only in shipped browsers, and removal takes months.

## Design decisions

**No JavaScript.** The content security policy sets `script-src 'none'`, so
there is no script execution path at all. All motion is CSS.

**No external requests.** System and locally-installed fonts only. No
analytics, no cookies, no pixels, no embedded widgets. Nothing loads from
another server.

**Motion is confined to entrances, on load, once.** Nothing animates on scroll:
content that fades in as you scroll is unpredictable, easy to miss, and can
strand text faded for anyone landing mid-page. `prefers-reduced-motion: reduce`
disables all of it and renders the final state immediately — which matters for
an audience that includes autistic and ADHD clients and their families.

**Light and dark modes** follow the system setting via `prefers-color-scheme`.
`prefers-contrast: more` is also honoured.

**Separate pages rather than one long scroll.** Each question a visitor might
have has its own URL, which is better for search, for sharing a specific
answer, and for anyone who finds a long page hard to navigate.

## Accessibility

- Skip link on every page
- Landmarks, breadcrumbs and a real heading hierarchy — one `h1` per page
- Both diagrams carry `role="img"` with `<title>` and `<desc>`
- Visible focus rings throughout
- WCAG AA contrast in both colour modes, measured rather than assumed. Light:
  tightest pair 4.65:1. Dark: tightest pair 5.64:1. Against a 4.5:1 floor.
  Re-check with a contrast tool if the palette changes — small uppercase labels
  fail first.
- Reduced motion fully respected
