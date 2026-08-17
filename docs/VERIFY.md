# verify.js — the pre-deploy gate

```
node scripts/verify.js
```

One command, no arguments. Exits **0** if everything passes, **1** if anything
fails, **2** if the script itself could not run. That exit code is the point:
it can gate a deploy.

It starts its own static server on port 8123, serving `public/` **with the
real headers from `_headers` applied**, drives it in headless Chromium, and
tears everything down afterwards. Nothing is left running and nothing outside
the repo is touched.

Output is a readable table on stdout plus `verify-report.json` in the repo
root, which is gitignored because it changes on every run.

## Dependency

Playwright, and only for this script. It is resolved from a local
`node_modules`, then from the common global paths. If it is missing:

```
npm i -D playwright
```

**The deployed site still has zero dependencies.** `scripts/` is not inside
`public/`, so nothing here is ever uploaded. There is no `package.json` in the
deployed output and nothing to carry a supply-chain vulnerability.

## What it checks

Twenty-one checks, 186 assertions — twenty per page across nine pages, plus one on the stylesheet.

| Check | What would fail it |
|---|---|
| head metadata | A page missing `lang`, `title`, meta description or canonical |
| internal links | A dead internal link or a `#fragment` with no matching id |
| no placeholders | Any unfilled `[BRACKETED]` value in any text asset |
| contrast | Any rendered text below 4.5:1 (3:1 for large text) against its computed background |
| duplicate ids | The same id twice on one page |
| accessible names | A link or button with no text, `aria-label` or `title` |
| image alt | An `<img>` with no `alt` attribute |
| svg labelled/hidden | An `<svg>` that is neither `aria-hidden` nor labelled |
| target size | A standalone control under 24×24px (WCAG 2.2 SC 2.5.8) |
| heading structure | More than one `h1`, or a skipped level |
| zero external requests | Any request to a host other than the local server |
| zero CSP violations | Any console violation against the real `_headers` policy |
| page weight | Total transferred bytes over the page's budget (see below) |
| CLS is zero | Any layout shift at all |
| no horizontal overflow | Content wider than the viewport at any of ten widths |
| 200% zoom reflow | Horizontal scroll at the 200% zoom equivalent |
| text-spacing override | Clipping under the WCAG 1.4.12 spacing overrides |
| reduced motion | Anything left below full opacity, or a stroked path not fully drawn |
| light under forced dark | A byte-different screenshot with the system set to dark |

Widths tested for overflow: 320, 360, 390, 414, 600, 768, 1024, 1280, 1440,
1920.

## Page weight budgets

`WEIGHT_BUDGET` in `scripts/verify.js` is a map, not a single number:
**100 KB** for every page, **180 KB** for `/`. Both cover everything the page
fetches, not just the HTML.

The home page's larger allowance is deliberate and specific to it: the
three-circles diagram carries ten emblems, which together come to about 90 KB
because they are one-channel masks emitted at 2x their largest rendered size.
Text pages carry only the masthead logo and still land in the low seventies.

If the home page ever pushes past 180 KB, **check whether an emblem is being
shipped larger than the layout can display it** before raising the ceiling —
that has been the cause every time so far. The sizes are the `JOBS` table in
`scripts/prepare-images.py`, and `docs/IMAGES.md` explains how they were
derived.

## Two checks worth understanding

**Target size** exempts links whose size is constrained by the text around
them, which is what WCAG 2.2 SC 2.5.8 allows. A link inside a sentence is
exempt; a navigation or list link is not. The script decides this by comparing
the link's text length against its parent block's — padding an inline link
would break the line rhythm for no compliance gain, so the exemption is
deliberate rather than an oversight.

**Placeholders** scans every `.html`, `.txt`, `.xml` and `.webmanifest` file,
not just the pages. It skips two things that legitimately look like a
placeholder: markdown links `[label](url)` in `llms.txt`, and any bracketed
run containing a quote, which catches JSON arrays and CSS attribute selectors.

That check was wrong on its first run. It required an uppercase first letter
and only looked at HTML, so it reported one placeholder when there were five —
it missed `[2]`, `[24 / 48]`, the payment-terms sentence and
`[SECURITY_TXT_EXPIRY]`. A gate that under-reports is worse than no gate,
because it manufactures confidence. If you extend this script, test that each
new check can actually fail.

## Current state

```
180/186 passed
```

The six failures are all the same thing: **content placeholders that have not
been filled in yet.**

| File | Outstanding |
|---|---|
| `.well-known/security.txt` | `[SECURITY_TXT_EXPIRY]` |
| `contact.html` | `[2]` |
| `faqs.html` | `[24 / 48]` |
| `privacy.html` | `[DATE]` |
| `sessions-and-fees.html` | `[2]`, `[24 / 48]` |
| `terms.html` | `[DATE]`, `[at the time of the appointment / within 7 days of invoice]`, `[24 / 48]`, `[2]` |

This is correct behaviour, not a bug. The site is not ready to deploy while it
still says "we reply within [2] business days" to a parent. Fill them in and
the gate goes green.

Everything else — every accessibility, layout, security, performance and
rendering check — passes on all nine pages.

## Adding a check

Call `record(check, page, pass, detail)`. Group by giving several pages the
same `check` name; the table aggregates them and the failure list shows each
one individually.

Before committing a new check, **make it fail on purpose once** and confirm it
reports. See above for why.

## When it fails in CI

The failure list names the check, the page and the specific detail. Start
there rather than re-running locally — the script is deterministic apart from
the CLS measurement, which uses a 600ms observation window.
