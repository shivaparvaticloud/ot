# Simple Roots Therapy — website

Static multi-page site. No build step, no framework, no JavaScript, no external
requests, no cookies, no contact form.

Built from two source documents: **Web Map.docx** (structure and copy) and
**Brand Kit.docx** (voice, colour, typography).

## Documentation

| Doc | What it covers |
|---|---|
| [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) | Hosting, config, deploy and rollback, custom domain, and the checks that can only run against the live origin |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Threat model, every response header and why its value, two open decisions |
| [`docs/EMAIL-DELIVERABILITY.md`](docs/EMAIL-DELIVERABILITY.md) | SPF, DKIM and DMARC for Microsoft 365 — the site's only contact route |
| [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) | Measured page weights and paint timings, and what is deliberately not optimised |
| [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md) | Load-bearing versus decorative features, and how each fails |
| [`docs/VERIFY.md`](docs/VERIFY.md) | The pre-deploy gate, check by check |
| [`docs/VISUAL-REGRESSION.md`](docs/VISUAL-REGRESSION.md) | Pixel baseline, tolerance, and how to update it honestly |
| [`docs/EDGE-CASES.md`](docs/EDGE-CASES.md) | Narrow viewports, raised font sizes, missing CSS — and the four bugs they caught |

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
| `public/sessions-and-fees.html` | Six-step process, session types, delivery modes, funding. Titled "Sessions" — the fees section was removed by request; the filename stays so existing links keep working |
| `public/faqs.html` | Seven questions |
| `public/contact.html` | Contact us |
| `public/privacy.html` | Privacy policy (required — health information is handled) |
| `public/terms.html` | Terms of service, scope and no-guarantee clauses |
| `public/404.html` | Not-found page |

Supporting files: `styles.css`, `_headers`, `robots.txt`, `sitemap.xml`,
`llms.txt`, `share.png`, `favicon-32.png`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png`, `site.webmanifest`,
`.well-known/security.txt`, and `images/` — twelve marks cut from the
supplied artwork.

Nothing is loaded from another server. A text page costs **four requests** —
the HTML, the stylesheet, the masthead logo and the favicon. The home page
costs fourteen, the extra ten being the emblems inside the three-circles
diagram.

Page weight, measured with everything the page fetches, is in
`docs/PERFORMANCE.md`. The home page carries a larger budget than the rest, a
deliberate exception documented in `scripts/verify.js`: the emblems are
one-channel masks emitted at 2x their largest rendered size, which is what
keeps ten of them affordable. See `docs/IMAGES.md`.

## Light only — how it is actually enforced

Three separate mechanisms, because `prefers-color-scheme` alone is not enough:

1. **No dark palette exists.** There is one set of custom properties and no
   `prefers-color-scheme` block, so there is nothing for a dark preference to
   switch to.
2. **`color-scheme: light`** in CSS and `<meta name="color-scheme" content="light">`
   in every head. This is what stops **Chrome on Android auto-darkening the
   page** — its automatic dark theme applies to sites that have not declared a
   scheme, and would otherwise invert the palette on a phone set to dark.
3. **`@media (forced-colors: active)`** for Windows High Contrast. In that mode
   the OS palette replaces ours by design; the block makes sure nothing
   disappears when it does — diagram strokes follow `CanvasText`, tinted fills
   become transparent rather than invisible shapes, cards keep a visible
   border, and focus uses `Highlight`.

Verified by loading every page with the browser's system preference forced to
**dark**: all nine still compute `rgb(247, 245, 240)` as the body background.

## Brand kit implementation

**The site is light for every visitor.** There is no dark palette and no
`prefers-color-scheme` switch — a visitor whose system is set to dark still
gets the light site. `color-scheme: light` is declared so scrollbars and any
native controls match.

**Colour** uses the supplied sage / slate / linen / ochre / plum palette, plus
the logo's own maroon:

| Supplied | Value | Where |
|---|---|---|
| Soothing Warm Neutral | `#F7F5F0` | Page background |
| Card background | `#FFFFFF` | Raised bands and cards |
| Clinical Trust Slate | `#2B3A4A` | Headings, the demand line |
| Calming Eucalyptus Green | `#6A8D95` | Diagram strokes, rules, icons |
| Gentle Warmth Accent | `#D4A373` | Decorative fills only |
| Accent | `#825358` | Small uppercase labels, icons, illustration figures |
| Logo maroon | `#7A3B43` | The masthead logo and the browser icons, nothing else |

**Two plums, and someone should decide whether that is one plum.** `#825358`
is the accent; `#7A3B43` is the colour sampled out of the supplied logo
artwork. They are close enough that on the same page they can read as one
colour applied inconsistently rather than as two roles. They are kept separate
because the instruction was to leave the logo's colour alone, and the accent
came in with the review comments — neither is a default. If the answer is that
they should be a single token, the logo is the one with a claim to its value,
so `--accent` is the one to move.

**Three colours were adjusted for contrast, on the same hues.** Measured, not
assumed:

1. **Sage `#6A8D95` cannot carry text.** It measures **3.29:1** on linen and
   **3.59:1** on white, against a 4.5:1 AA floor. It clears the 3:1 threshold
   for graphics, so it drives diagram strokes, rules and icons — and never
   text.
2. **Links and buttons use `#58757C`**, a darker step on the same hue: 4.53:1
   on linen, 4.94:1 on white, and 4.94:1 for white text on the button fill.
   Note the supplied hover value `#58777E` was very close but measured
   **4.43:1** on linen — a hair under — so the accent is one shade darker than
   it. Hover is `#496167`.
3. **White text on sage `#6A8D95` fails at 3.59:1.** The mockup's primary
   button used exactly that pairing, so button fills use `#58757C` instead.
4. **Ochre `#D4A373` cannot carry text either** — 2.08:1 on linen, which misses
   even the 3:1 graphics threshold. It is used only as a low-opacity
   decorative fill (the centre of the three-circles diagram), never for text,
   and never as the only thing distinguishing one element from another. If you
   ever need ochre as text, `#8A6A4B` is the same hue at 4.54:1.

5. **The accent `#825358` can carry text**, unlike the other two brand hues:
   **5.79:1** on linen and **6.31:1** on white. It is given the small
   uppercase label layer — eyebrows, section leads, definition terms, the
   masthead role line — plus the icons and the paediatric illustration, which
   puts it on every page without ever being mistaken for a link. Under
   `prefers-contrast: more` it steps up to slate, since 5.79:1 is AA but not
   AAA.

Body copy steps down in three levels — `#4A5568`, `#55636F`, `#5F6E79` — all
above 4.5:1 on both linen and white. Every pair in the palette now passes;
tightest is the accent on linen at 4.53:1.

`share.png` uses the same palette.

**The favicon and app icons are the supplied vertical logo**, cropped to the
tree-and-fingerprint mark — the wordmark under it is illegible at 32 px and
only muddies the shape. They are inked on an opaque linen square rather than
left transparent: maroon on a dark browser tab strip measures about 2:1,
whereas on its own linen ground it is 7.4:1 wherever the icon lands. There is
one version rather than a light/dark pair, for the same reason.

The earlier hand-drawn `favicon.svg` has been removed. Leaving it in place
would have kept overriding the logo, since browsers prefer an SVG icon to a
PNG one.

**The logo keeps its own maroon — decided, not defaulted.** `#7A3B43` was
sampled from the supplied artwork rather than chosen, and it sits outside the
sage / slate / linen / ochre palette the rest of the site is built from. The
alternative was redrawing the logo in the kit's colours; the instruction was
to leave it as it is, so the kit has five colours rather than four and the
logo is never recoloured.

What keeps that from turning into drift: maroon lives in one token,
`--brand-maroon`, exposed as `--logo-ink`, and is used by the masthead logo
and the browser icons and **nowhere else**. It is not a text colour, not a
link colour, and not a diagram colour — the emblems inside the three circles
are sage, like the rings around them. If maroon starts appearing anywhere a
reader could mistake it for an accent, the two systems have begun to bleed
and something has gone wrong.

It reads correctly on linen at 7.44:1, well clear of the 3:1 graphics floor —
which is the whole reason it can stay as it is without costing anything in
accessibility.

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
- **Several supplied images have no clear licence.** One is another
  business's logo, one carries a studio watermark, one is a captioned poster
  print. They are in use on the home page now. See "Before launch: clear the
  artwork" in `docs/IMAGES.md` — this needs resolving before the site goes
  live, not after.
- **`image-10`, a tick in a circle, is prepared but placed nowhere.** No
  reading of the three roots is illustrated by a checkmark. Either use it on
  one of the tick lists or delete it.
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
| `[24 / 48]` | Cancellation notice window |
| `[at the time of the appointment / within 7 days of invoice]` | Payment terms — pick one |
| `[DATE]` | Date the legal pages were last updated |
| `[SECURITY_TXT_EXPIRY]` | ISO timestamp under a year away, e.g. `2027-06-30T00:00:00.000Z` |

## No fees are published

By instruction, the site carries **no dollar amounts and no price
indicators** — `priceRange` has been removed from the structured data too,
since `$$` is still a price signal. The sessions page describes what each
session type *is*. `llms.txt` tells AI assistants the same thing and asks them
not to quote a figure.

Two things here changed on the client's later instruction, and are deliberate
rather than drift: the **Fees** section was deleted from the sessions page
altogether, and **session lengths are now stated in minutes** ("typically 60
minutes face-to-face, with 10 minutes clinical record and planning time").
Durations are not prices, and the client asked for them explicitly. The
statement that fees are discussed on the free call now lives only in
`terms.html`.

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
duplicated across all nine pages. **A nav change means editing nine files** —
as does a logo change, since the masthead carries the wide logo as an inline
SVG mask on every page.
That is the trade-off for a site with no build tooling; a find and replace
across `public/*.html` handles it.

The footer used to carry two disclaimers — an urgent-support block naming
Lifeline, and a "general information, not clinical advice" paragraph. Both
were removed from all nine pages at the client's instruction. The equivalent
scope-of-practice and crisis wording still exists in `terms.html`, which is
where it is load-bearing; do not reinstate the footer block without asking.

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

## Images

The masthead logo, the browser icons and the ten emblems inside the
three-circles diagram are all cut from the supplied artwork by
`scripts/prepare-images.py`. That script is a one-off asset tool — **the
deploy path is still build-free**, `public/` is uploaded as it sits.

Two things about it are load-bearing and easy to undo by accident:

1. **The marks are masks, not pictures.** They carry no colour of their own;
   `--graphic-motif` and `--logo-ink` supply it. That is what lets Windows
   High Contrast mode substitute its own ink, and what keeps them small.
2. **There is no `<img>` element anywhere on the site.** Every mark is an SVG
   `<mask>` on a `<rect>`, so no emblem can be saved, copied or opened in a
   tab from the context menu, and none is selectable or draggable.

**Read `docs/IMAGES.md` before touching any of it** — particularly the section
on clearing the artwork, which is unfinished business rather than background.

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

## Verification

Three scripts, all runnable locally, all against the site served with its
real `_headers`:

```
node scripts/verify.js        # 21 checks, 186 assertions
node scripts/visual-diff.js   # 81 captures, 9 pages x 3 widths x 3 modes
node scripts/edge-cases.js    # narrow viewports, raised font size, no CSS
```

See `docs/VERIFY.md`, `docs/VISUAL-REGRESSION.md` and `docs/EDGE-CASES.md`.

Everything below was measured in a headless browser against the site served
with its real `_headers` CSP, not asserted. Re-run these after any change.

| Check | Result |
|---|---|
| Light theme with system set to dark | 9/9 pages render `#F7F5F0` |
| Rendered text contrast, every visible element | 0 failures |
| Horizontal overflow at 320/360/390/768/1024/1440px | none |
| 200% zoom (640px equivalent) | no horizontal scroll |
| Text-spacing override (WCAG 1.4.12) | reflows without clipping |
| Duplicate IDs, nameless links, missing `alt` | none |
| Heading order, one `h1` per page | clean |
| Internal links and anchors | all resolve |
| Tap targets (WCAG 2.2 SC 2.5.8) | all standalone controls ≥24×24 |
| Keyboard | skip link is first stop and moves focus to `#main`; focus ring visible |
| Reduced motion | final state renders immediately, nothing stranded faded |
| Print stylesheet | nav and sticky bar hidden, content intact |
| HTML tag balance | 9/9 clean |
| JSON-LD | valid on all pages, no `Review`/`AggregateRating` |
| Requests per page | 3 (HTML + CSS + logo), 13 on the home page, zero external, zero CSP violations |
| Page weight | 70–79 KB on text pages, 163 KB on the home page, both inside budget |
| Context menu on any mark | resolves to a `<rect>` — no save, copy or open-in-tab |

Two notes on the tap-target check. It found 151 failures on the first pass —
navigation, breadcrumb, footer and list links were all around 21px tall — now
fixed with a `min-height` and vertical padding on standalone links. The seven
that remain are links **inside a sentence**, which SC 2.5.8 exempts because
their size is constrained by the surrounding line-height; padding those would
break the text rhythm for no compliance gain, so they are deliberately left.

This matters more than the usual box-ticking here: the practice treats gross
and fine motor difficulties, so small targets fail exactly the people most
likely to be using the site.

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
