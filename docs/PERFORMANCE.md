# Performance

Measured, not estimated. Reproduce with the scripts in `scripts/`, served
locally with the real `_headers`.

## Where it stands

Every page loads in **two requests** — the HTML and `styles.css`. The home
page makes a third for the logo. There is no JavaScript, no webfont, no
analytics, no third-party anything, so there is nothing else to fetch.

| Page | Requests | Raw | gzip | brotli |
|---|---|---|---|---|
| index | 3 | 61.1K | 25.1K | **22.7K** |
| services | 2 | 48.6K | 14.6K | 11.9K |
| faqs | 2 | 48.0K | 13.0K | 10.7K |
| privacy | 2 | 46.2K | 13.5K | 11.1K |
| terms | 2 | 45.7K | 13.3K | 10.9K |
| sessions-and-fees | 2 | 45.0K | 13.1K | 10.8K |
| about | 2 | 43.9K | 12.8K | 10.5K |
| contact | 2 | 42.4K | 12.2K | 10.1K |
| 404 | 2 | 40.6K | 11.5K | 9.5K |

**CLS is zero on every page**, asserted by `verify.js` rather than observed
once. LCP equals FCP everywhere — the largest element is painted in the first
paint, because nothing arrives late.

`styles.css` is 36.5K raw but **8.5K brotli**, and it is the same file on
every page, so it is fetched once and served from cache for the rest of the
visit. Splitting it per page would trade a warm cache hit for a second round
trip; it is not worth it at this size.

## The one thing that was actually slow, and why

The home page logo was being over-fetched on phones, and the artwork was
distorted. Both came from the same mistake.

The derivatives were generated with heights chosen independently rather than
derived from the master's aspect ratio:

| File | Was | Ratio | Now | Ratio |
|---|---|---|---|---|
| master | 1284x678 | 1.894 | — | 1.894 |
| 240 | 240x136 | 1.765 | 240x127 | 1.890 |
| 480 | 480x273 | 1.758 | 480x253 | 1.897 |

So the logo shipped **stretched about 7% vertically**, and the two variants
were not even stretched by the same amount. Being un-stretched also made them
smaller: the 240 WebP fell from 15.3K to 11.4K.

The second half was the descriptor type. `srcset` used `1x`/`2x`, but the
logo renders at two different CSS widths — 240px normally, 180px below 46rem.
A phone at DPR 2 needs 360px of image and was handed the 480. Width
descriptors plus `sizes` mirroring the CSS breakpoints fix it, with a 360w
variant added to land on:

| Context | Picks | Transfer |
|---|---|---|
| desktop @1x | 240w | 11.4K |
| mobile @2x | 360w | 17.9K (was 33.5K) |
| mobile @3x | 480w | 27.7K |

Mobile at DPR 2 is the common phone case, so that is **15.6K saved on the
most bandwidth-sensitive visit**, and the home page dropped from 26.4K to
22.7K brotli overall.

The lesson worth keeping: a derived image's height must come from the
master's ratio, never from a number typed next to the width. `width` and
`height` on the `<img>` have to match, or the reserved box distorts the
artwork while still reporting CLS of zero — the layout is stable, it is just
stably wrong.

## What is deliberately not optimised

**`icon-512.png` is 187K.** It is large for an icon, and it is the biggest
file in `public/`. It is also not on the critical path: manifest icons are
fetched when a browser installs the site as an app, not during page load.
Confirmed by listing every request on load — desktop and mobile both fetch
exactly three things, none of them an icon.

It could be roughly halved by palette-quantising the PNG, but there is no
image tooling in this environment (`no PIL`, no `pngquant`, no ImageMagick)
and hand-rolling a quantiser for an off-path asset is not a good trade. If it
matters later, run the four icons through `pngquant --quality 65-85`.

**`styles.css` is not minified.** Brotli does most of what minification would,
and the comments in it are the design system's documentation — the file
explains why the tokens hold the values they do. 8.5K over the wire is not
worth trading that for.

## How to reproduce

Page weight and paint timings:

```
node scripts/verify.js        # asserts CLS, page weight, zero external requests
node scripts/visual-diff.js   # 81 captures; catches anything that moves
```

Note that the numbers above come from a local server on loopback, so **FCP and
LCP figures reflect render cost, not network latency**. They are useful for
comparing pages against each other and for catching a regression; they are not
a substitute for a field measurement against the deployed origin.

## If a regression appears

In order of likelihood on a site shaped like this one:

1. **A third-party embed.** The CSP blocks it outright, so it will show as a
   console violation rather than a slow page. That is the intended failure.
2. **An unsized image.** `verify.js` asserts CLS is zero and will catch it.
3. **A new variant with a mismatched ratio.** `verify.js` now asserts that
   every `<img>`'s width/height attributes agree with the file's own
   intrinsic ratio, which is the check that would have caught the logo bug.
   Negative-tested: restoring the old `height="136"` fails the run with
   `attr 1.765 vs file 1.890`.
4. **`styles.css` growth.** Watch the brotli figure, not the raw one.
