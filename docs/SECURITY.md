# Security posture

Re-verified after the CSP was tightened. This records what is set, why each
value was chosen, what is actually verified rather than assumed, and the two
decisions still open.

## Threat model

This is a static brochure site for a solo health practice. It has no database,
no cookies, no sessions, no user accounts, no browser JavaScript and no
third-party resources. A small same-origin Worker handles one contact endpoint;
it has no database or session state. Whole categories of web
vulnerability — injection, broken auth, SSRF, deserialisation, XSS via a
vulnerable dependency — do not have a place to live here.

What is actually at risk, roughly in order:

| Risk | Handled by |
|---|---|
| Someone impersonating the practice by email | SPF/DKIM/DMARC — see `EMAIL-DELIVERABILITY.md` |
| Transport interception or downgrade | HSTS, `upgrade-insecure-requests` |
| Defacement via repository or Cloudflare account compromise | Outside the site's control — 2FA on both accounts |
| The site being framed to phish visitors | `frame-ancestors 'none'` + `X-Frame-Options` |
| A future change silently introducing a tracker | CSP refuses it rather than failing quietly |

That last row is the one doing ongoing work. The policy is written to make
the site's *current* properties enforceable, so that a later edit which adds
an analytics snippet or an embedded font is blocked by the browser instead of
shipping unnoticed.

Health information is not requested by the form: its warning asks visitors for
only a short general enquiry. The privacy policy explains that form submissions
are handled as correspondence and delivered to the practice by email.

## Response headers

All of these are set under `/*` in `public/_headers`, so they apply to every
response including 404s.

### Content-Security-Policy

Every directive is named explicitly rather than leaning on `default-src`.
That is deliberate: `default-src` does not cover `form-action`,
`frame-ancestors` or `base-uri`, and a reader should not have to remember
which directives fall through and which do not.

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | Backstop for anything not named below |
| `script-src` | `'none'` | The site has no JavaScript, and now cannot acquire any |
| `style-src` | `'self'` | One external stylesheet, no inline styles |
| `img-src` | `'self' data:` | `data:` is needed for nothing currently, but keeps inline SVG data URIs available without a policy change |
| `font-src` | `'self'` | System font stack only; no webfont is fetched |
| `connect-src` | `'none'` | No fetch, XHR, WebSocket or beacon |
| `media-src` | `'none'` | No audio or video |
| `object-src` | `'none'` | No plugins |
| `frame-src` / `child-src` | `'none'` | Nothing is embedded |
| `worker-src` | `'none'` | No service worker |
| `manifest-src` | `'self'` | `site.webmanifest` |
| `form-action` | `'self'` | The native form can post only to this site's Worker endpoint |
| `frame-ancestors` | `'none'` | The site cannot be framed |
| `base-uri` | `'self'` | Stops an injected `<base>` redirecting every relative URL |
| `upgrade-insecure-requests` | — | Any `http://` subresource is fetched over TLS |

`'unsafe-inline'` appears nowhere. It was in `style-src` until five inline
`style="animation-delay:…"` attributes on the services page were moved to
classes. With `script-src 'none'` alongside, the page now permits no inline
code of either kind.

**JSON-LD is unaffected by `script-src 'none'`.** A `<script type="application/ld+json">`
block is a data block: the HTML spec says it is not executed, and CSP does not
apply to it. The structured data works with scripting fully denied.

### Transport and framing

| Header | Value | Note |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | One year, all subdomains. See the open decision below. |
| `X-Content-Type-Options` | `nosniff` | No MIME sniffing |
| `X-Frame-Options` | `DENY` | Redundant with `frame-ancestors`, kept for old browsers |
| `X-Permitted-Cross-Domain-Policies` | `none` | Blocks Adobe cross-domain policy files |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends origin only across origins, nothing over a downgrade |

### Cross-origin isolation

| Header | Value |
|---|---|
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `require-corp` |

### Permissions-Policy

Every powerful feature is denied to every origin, including the site itself:
accelerometer, autoplay, camera, display-capture, encrypted-media, fullscreen,
geolocation, gyroscope, magnetometer, microphone, midi, payment,
picture-in-picture, publickey-credentials-get, screen-wake-lock, serial, usb,
xr-spatial-tracking, interest-cohort.

`interest-cohort=()` opts out of FLoC. That API is gone, but the token costs
nothing and documents the intent.

## security.txt

`/.well-known/security.txt` follows RFC 9116, so a researcher who finds
something has somewhere to send it rather than guessing or disclosing
publicly. `Expires` must stay under a year away and be refreshed — an expired
security.txt is treated as invalid.

## Caching

Only the nine static assets are given `Cache-Control: public, max-age=86400`.
HTML is deliberately left without one so a correction goes out promptly.

A day rather than a year because none of these filenames are content-hashed:
`styles.css` stays `styles.css` when it changes. Long enough to matter,
short enough to fix a mistake.

The rules are listed one file at a time rather than as `/*.png`. Wildcard
matching in `_headers` is documented for Pages but not confirmed for Workers
static assets, and a pattern that silently failed to match would leave the
assets uncached — which is exactly the bug that was already in the file.

## What is verified, and how

`node scripts/verify.js` asserts, per page, against the real `_headers`:

- **zero CSP violations** — the browser console is watched during load; any
  refusal fails the run
- **zero external requests** — every request the page makes is checked
  against the site's own origin

Separately confirmed for this re-verify: all ten security headers are present
on HTML, CSS, PNG, WebP, webmanifest, txt and xml responses, and on 404s.

### A caveat about the local checks, now fixed

The test server parses the real `_headers`, but it used to flatten every
indented line in the file into a single set and apply all of it to every
response, ignoring the path patterns entirely.

The CSP conclusions were unaffected — the CSP sits under `/*` and is global
either way — but per-file `Cache-Control` leaked onto every response, so the
server reported HTML as cacheable when the edge does not, and no path-scoped
rule could have been tested at all. The parser now matches paths in file
order, later rules overriding earlier ones, as Cloudflare does.

### What is not verified here

Header delivery is confirmed against the local server and against
Cloudflare's documentation for `_headers` on Workers static assets — the file
is inside the configured assets directory, uses 10 of the 100 permitted rules,
and its longest header is 358 of the permitted 2000 characters. It has **not**
been confirmed against the deployed URL from this environment, because the
network policy here denies that host. Worth one check after deploy:

```
curl -sI https://simplerootstherapy.com.au/ | grep -i -E 'content-security|strict-transport'
```

## Open decisions

**HSTS preload.** The header already carries the `preload` token, so the
domain is eligible the moment anyone submits it at hstspreload.org. Nothing
has been submitted. Worth understanding before doing so: preload is baked
into browser binaries, `includeSubDomains` covers *every* subdomain including
ones not created yet, and removal takes months to reach users. For a domain
that will only ever serve HTTPS this is the right end state, but it should be
a deliberate choice, and it is easier to make after any subdomains
(mail, booking, staging) already exist and are known to be TLS-only.

**COEP `require-corp`.** This buys cross-origin isolation the site does not
currently need — there are no SharedArrayBuffers or high-resolution timers to
protect. What it costs is future embedding: a booking widget, a map, or a
YouTube video would be blocked until the third party sends `Cross-Origin-Resource-Policy`
or the header is relaxed. Correct while the site embeds nothing; expect to
revisit it the first time an embed is wanted, and change it knowingly rather
than debugging a blank frame.
