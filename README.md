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
| `public/robots.txt` | Search engine directives |
| `public/sitemap.xml` | The three indexable pages |
| `wrangler.toml` | Worker name, asset directory, 404 handling |

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
