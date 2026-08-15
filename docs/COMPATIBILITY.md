# Browser compatibility

What the site uses, what happens where it is not supported, and which parts
are load-bearing versus decorative.

## How CSS fails, and why it matters here

Three different failure modes, and the difference decides how a feature can
safely be used:

| What is unsupported | What the browser drops |
|---|---|
| An unknown property, or an unknown value in a known property | that one declaration |
| An unknown at-rule (`@view-transition`, `@container`) | the whole at-rule |
| **An unrecognised selector** | **the entire rule, including every other selector in the list** |

The third is the dangerous one. A modern pseudo-element sharing a selector
list with ordinary styles takes them all down with it in any browser that
does not know it.

Checked mechanically across the whole stylesheet, at every nesting level:
**259 selector lists, 2 containing a modern selector, 0 risky.** Both are
isolated in their own rules —

```css
::view-transition-old(root), ::view-transition-new(root){ … }   /* both modern */
details::details-content{ … }                                    /* on its own */
```

If you add `:has()`, `::backdrop` or similar, give it its own rule. Do not
append it to an existing selector list.

This is enforced, not just advised — `verify.js` runs the same scan and fails
if a modern selector shares a list with an ordinary one. Negative-tested by
adding `.card` alongside `::details-content`, which fails the run with
`would also lose .card`.

## Load-bearing

If these are missing the site does not look right. There is no fallback, and
that is a deliberate choice rather than an oversight — supporting browsers
without them would mean a second parallel stylesheet.

| Feature | Used for |
|---|---|
| Custom properties | The entire token system. Every colour, space, size and duration. |
| Logical properties (`inline-size`, `padding-block`, `margin-inline`, `inset-inline`) | All sizing and spacing — 142 occurrences |
| `clamp()` | Every type step, all nine of them |
| `min()` | Grid track floors and the diagram's minimum width — 8 uses, and the fix for four separate overflow bugs |
| Grid and flexbox with `gap` | Every multi-column layout |

The practical floor is a browser from roughly 2021 onward. A browser older
than that gets HTML with most of the stylesheet's declarations dropped —
which is degraded but still readable, because the markup is ordered and
semantic. That is not a guess: `scripts/edge-cases.js` renders every page
with the stylesheet blocked entirely and asserts the content is still
present, headed and free of horizontal overflow. That test doubles as the
floor for browsers too old to use the CSS.

## Progressive enhancement — absence costs nothing

| Feature | Where | Without it |
|---|---|---|
| `@view-transition` | navigation | Pages navigate normally. Firefox does this today. |
| `view-transition-name` | masthead, footer, sticky CTA | Ignored |
| `::details-content` | print | Answers still print — a separate `display:block !important` rule on the closed children covers older engines. Both mechanisms are present because engines disagree. |
| `text-wrap: balance` / `pretty` | headings, prose | Ordinary wrapping |
| `vector-effect: non-scaling-stroke` | diagram strokes | Strokes scale with the SVG; slightly heavier at large sizes |
| `prefers-contrast: more` | colour tokens | No boost. The base palette already meets AA, so this only removes an enhancement. |
| `forced-colors` | high-contrast mode | Block does not apply; base styles are used |
| `columns` | in-page contents | One column instead of two |
| `@page` margins | print | The browser's own print margins |
| WebP | logo | `<picture>` falls back to the PNG automatically |

## Deliberately not used

**Container queries and `subgrid`.** Nothing here needs them. The two
multi-column grids use `repeat(auto-fit, minmax(min(16rem, 100%), 1fr))`,
which adapts to available width without a query and without a breakpoint.
Adding container queries would raise the browser floor for no behavioural
gain.

**`:has()`.** No selector in the design calls for it.

**JavaScript, in any form.** `script-src 'none'`. This is the reason the FAQ
disclosure is `<details>` and the page transitions are `@view-transition` —
both are declarative, so the site gets the behaviour without a policy
exception. Nothing degrades when scripting is off, because nothing depends on
it being on.

## Two behaviours that are not about support

**Chrome on Android auto-darkens light pages** on some devices even when the
page never opts into a dark theme. `color-scheme: light` plus the matching
`<meta name="color-scheme">` is what prevents it. `verify.js` asserts every
page renders identically under a forced dark colour scheme, so a regression
here fails the run rather than being discovered on someone's phone.

**Compositing changes pixels without changing layout.** `view-transition-name`
promotes an element to its own layer, which rasterises text with slightly
different snapping. Confirmed as cosmetic — geometry is identical to three
decimal places with the property on and off. Details in
`docs/VISUAL-REGRESSION.md`.

## What has actually been tested

Everything above marked as verified was measured in headless Chromium, which
is one engine. **Behaviour in Safari and Firefox is inferred from the specs,
not observed.** The features where that matters most are `@view-transition`
(Firefox does not implement it — expected to navigate plainly) and
`::details-content` (which is why the older `display` fallback is kept
alongside it).

Worth doing before launch, and not possible from this environment: open the
deployed site once in Safari and once in Firefox, and confirm the FAQ
disclosure, the print output and the logo all behave.
