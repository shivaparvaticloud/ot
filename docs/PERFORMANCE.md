# Performance

Measured, not estimated. Reproduce with the scripts in `scripts/`, served
locally with the real `_headers`.

## Where it stands

A text page loads in **four requests** — the HTML, `styles.css`, the masthead
logo and the favicon. The home page makes fourteen, the extra ten being the
emblems inside the three-circles diagram. There is no JavaScript, no webfont,
no analytics, no third-party anything, so there is nothing else to fetch.

| Page | Requests | Raw | gzip | brotli |
|---|---|---|---|---|
| index | 14 | 170.6K | 124.8K | **121.5K** |
| services | 4 | 97.5K | 55.7K | **52.4K** |
| faqs | 4 | 94.9K | 53.3K | **50.6K** |
| privacy | 4 | 93.0K | 53.8K | **51.0K** |
| terms | 4 | 92.5K | 53.7K | **50.8K** |
| sessions-and-fees | 4 | 91.8K | 53.5K | **50.7K** |
| about | 4 | 91.3K | 53.4K | **50.7K** |
| contact | 4 | 89.2K | 52.5K | **50.0K** |
| 404 | 4 | 87.4K | 51.8K | **49.4K** |

**Compression barely moves these totals, and that is expected.** PNG is
already deflate-compressed, so brotli finds almost nothing left in it — the
gap between raw and brotli is almost entirely the HTML and CSS. Judge image
work by the raw column; judge markup work by the brotli one.

**CLS is zero on every page**, asserted by `verify.js` rather than observed
once. LCP equals FCP everywhere — the largest element is painted in the first
paint, because nothing arrives late.

`styles.css` is 36.5K raw but **8.5K brotli**, and it is the same file on
every page, so it is fetched once and served from cache for the rest of the
visit. Splitting it per page would trade a warm cache hit for a second round
trip; it is not worth it at this size.

## The lesson from the logo derivatives

This section describes machinery that **no longer exists** — the hero logo
lockup and its six `logo-wide-*` derivatives were removed when the logo moved
into the masthead as a mask, which needs one file at one size and no `sizes`
attribute to get wrong. The finding is kept because the mistake is easy to
repeat the next time anything ships a `<picture>`.

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

## The icons were quantised after all

An earlier note here said `icon-512.png` was 187K and could not be reduced
because the environment had no image tooling. Both halves have since changed:
`scripts/prepare-images.py` brought Pillow in to cut the diagram artwork, and
once a quantiser was available the icons got one for free. They are two
colours and the antialiasing between them, so a 64-entry palette is
indistinguishable from truecolour:

| Icon | Was | Now |
|---|---|---|
| `icon-512.png` | 187K | 42.2K |
| `icon-192.png` | 34.0K | 9.2K |
| `apple-touch-icon.png` | 30.2K | 8.3K |
| `favicon-32.png` | 2.3K | 0.7K |

None of these are on the critical path — manifest icons are fetched at app
install, not page load — so this was cheap rather than important. It is
recorded because the previous note would otherwise send someone looking for
`pngquant` that the project no longer needs.

## What is deliberately not optimised

**The diagram emblems are not shrunk further.** Ten of them come to about
70K raw, which is most of the home page. They are already one-channel masks
rather than colour images — about a third of the RGBA equivalent — and they
are sized to exactly 2x their largest rendered size, which is set by the
diagram's `max-inline-size`. Going below that trades visible sharpness on
high-density screens for bytes on a page that is still well under a quarter
of a megabyte. See `docs/IMAGES.md`.

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
