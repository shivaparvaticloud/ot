# Images

```
pip install Pillow numpy
python3 scripts/prepare-images.py
```

Rebuilds every image the site serves from the artwork in
`assets/source-images/`. It is a **one-off asset tool, not a build step** — the
deploy path is unchanged, `public/` is still uploaded exactly as it sits on
disk. The script exists so the route from supplied artwork to shipped asset is
reproducible and reviewable rather than a folder of undocumented exports.

## Where things live

| Directory | Contents | Deployed? |
|---|---|---|
| `assets/source-images/` | The 13 supplied files, untouched, at their original resolution | **No** — outside `public/` |
| `public/images/` | 12 web assets derived from them | Yes |
| `public/*.png` | The favicon and app icons, also derived from the logo | Yes |

Keeping the masters out of `public/` is deliberate and does two jobs. The
originals stay in version control at full resolution, and they do not end up
sitting at a guessable URL on the live site — `image-4.png` at 1.9 MB would
otherwise be one address bar away, which is the opposite of what the artwork
is for.

## The supplied files, and where each one went

| Source | Becomes | Where it appears |
|---|---|---|
| `vertical-logo.png` | `favicon-32`, `apple-touch-icon`, `icon-192`, `icon-512` | Browser tab and app icons |
| `wide-logo.png` | `images/logo-wide.png` | Masthead, left of the wordmark, every page |
| `image-1.jpg` | `images/self-figure.png` | **Self** — the fingerprint figure, the circle's main emblem |
| `image-11.jpg` | `images/self-seated.png` | **Self** — smaller seated figure beside it |
| `image-3.png` | `images/env-tree.png` | **Environment** — the rooted tree |
| `image-2.png` | `images/env-sapling.png` | **Environment** — the sapling beside it |
| `image-4.png` | `images/others-family.png` | **Others** |
| `image-5.png` | `images/others-circle.png` | **Others** |
| `image-6.png` | `images/others-reaching.png` | **Others** |
| `image-7.png` | `images/others-hands.png` | **Others** |
| `image-8.png` | `images/others-holding.png` | **Others** |
| `image-9.png` | `images/others-pair.png` | **Others** |
| `image-10.jpg` | `images/tick.png` | **Nowhere yet** — see below |

`image-9` and `image-11` were not assigned in the brief. `image-11` is a seated
figure, so it joined `image-1` in Self; `image-9` is two figures, so it joined
the group in Others.

**`image-10` is a plain tick in a circle** and is not in the diagram. There is
no reading of Self, Environment or Relationships that a checkmark illustrates,
and putting one inside a circle would look like a mistake rather than a
decision. It is prepared and sitting in `public/images/` ready to use — the
services and sessions pages have tick lists it would suit — but nothing
references it. Delete it or place it; do not leave it drifting.

## What the script does to each mark

**It cuts the mark out of its own background.** The artwork arrives on a dozen
different grounds: olive, forest green, kraft paper, pale yellow, four
different off-whites. Pasted onto the site's linen as rectangles they read as a
mood board rather than a diagram. Separation is by **colour distance from the
background**, not luminance — `image-9` is coral on pale yellow, which no
luminance threshold separates at all.

**It emits masks, not pictures.** `public/images/*.png` are greyscale
luminance masks, white where the ink is. The colour comes from CSS, via
`--graphic-motif` for the diagram and `--logo-ink` for the masthead. Three
things follow from that:

- the palette stays in `styles.css` with the rest of the palette, so
  recolouring the whole emblem set is a one-line change;
- **Windows High Contrast mode works properly** — the emblems take `CanvasText`
  like any other fill, instead of staying stuck in a colour the OS palette has
  replaced. Verified in `tests/baseline/index-*-contrast.png`;
- one channel is about a third of the bytes of the RGBA equivalent, which is
  most of the reason the home page fits its budget.

**It crops away captions and third-party wordmarks** through the `CROP` table,
so a re-run cannot quietly reintroduce them.

**The icon source is not one of the twelve.** The square icons are flattened
colour PNGs, not masks, and they are built from the vertical logo in memory —
so `ICON_SOURCE` sits outside `JOBS` deliberately. Moving it into `JOBS` would
write the intermediate mask into `public/images/` and deploy 26 KB that no
page ever requests. If you add another icon size, add it to `ICON_SIZES`.

**It corrects ink weight after scaling.** The big tree is drawn as thousands of
separate leaf strokes; averaged down to 240 px they turn into a pale grey cloud
that reads as a smudge beside the solid silhouettes. A gamma applied *after*
the resample fixes it. Correcting earlier only thickens the strokes at full
size and washes out again on the way down.

## Resolution

Every mark is emitted at roughly **2× the largest size the layout can ever
display it**, so it stays sharp on high-density screens without shipping pixels
the page cannot use. Raising them past 2× costs bytes on every visit and
changes nothing anyone can see.

**That ceiling is `.pillars svg { max-inline-size }` in `styles.css`, and the
sizes in `JOBS` are derived from it.** It is pinned to the viewBox width —
`41.25rem` for 660 units — so one user unit is one CSS pixel and each emblem
simply ships at twice its height in units. Keeping those two numbers equal is
what makes the sizing checkable by hand.

That value has already moved twice, and both times the emblems silently
changed sharpness without anything failing. **If you change it again,
recompute every entry in `JOBS`.**

The full-resolution originals are untouched in `assets/source-images/`. If the
diagram is ever redesigned larger, re-run the script with bigger values rather
than upscaling what is in `public/`.

## Diagram geometry

The three-circles SVG is `viewBox="0 0 660 570"`:

| Circle | Centre | Radius |
|---|---|---|
| Self | 330, 190 | 150 |
| Environment | 221, 376 | 150 |
| Others | 439, 376 | 150 |
| Centre disc | 330, 314 | 78 |

Three equal circles on an equilateral triangle, symmetric about the vertical
axis. It is drawn larger relative to the type than a plain circles-and-labels
diagram would be, because every circle also has to hold artwork: the emblems
need exclusive room that the labels and the centre disc do not already take.

Every emblem sits **wholly inside its own circle and wholly outside the other
two**, and clear of the ochre centre. That is not a stylistic preference — an
emblem straddling a ring makes the diagram stop reading as three distinct
roots. If you move one, check all four corners against all three circles
before committing; the useful test is that the corner farthest from its own
centre is still within 150, and the corner nearest each other centre is still
beyond 150.

## Nothing opens, saves or drags

The brief asked that the images not be separable from the site. What is in
place:

- **There is not a single `<img>` element on any page.** Every mark is an SVG
  `<mask>` applied to a `<rect>`. Right-clicking any emblem or the logo hits
  the rectangle, so the browser offers its ordinary page menu — no *Save image
  as…*, no *Copy image*, no *Open image in new tab*. Measured, not assumed:
  the hit target at the centre of all ten emblems is `rect.pl-motif`.
- **No image is inside a link that could open it.** The logo sits in the
  masthead home link, which navigates to `/`.
- **The diagram is not selectable or draggable** (`user-select: none`).
- **`/images/*` is served `X-Robots-Tag: noindex, noimageindex`**, which keeps
  the marks out of image search — the one route by which someone would
  otherwise arrive at one on its own.

**The honest limit.** A browser has to download an image in order to draw it,
so the file must be fetchable, and the paths are visible in the page source.
Someone who opens devtools or types the URL can still retrieve one. Everything
above removes the casual routes — the context menu, the drag, the image search
result — and there is no technique, with or without JavaScript, that removes
the last one. Anything sold as doing so is theatre. What the visitor gets is a
white-on-black mask with no colour and no context, which is worth knowing
before spending more effort here.

## Before launch: clear the artwork

**Several of the supplied images look like mood-board finds rather than
licensed assets**, and three carry positive evidence of it:

- **`image-5`** is the logo of **HŌMA Mykonos**, a hospitality business. The
  wordmark sat directly under the ring of figures.
- **`image-6`** carries a **studio watermark** across the bottom.
- **`image-4`** is a printed poster, captioned **"UNITY"** with a verse below.

The script crops those away because the captions do not belong in a diagram at
this size. **Cropping is a layout decision and settles nothing about rights.**
Another business's logo does not become available for use because its wordmark
was removed — if anything that is worse, and this is a registered health
practice advertising a commercial service, where the exposure is real.

`image-3`, `image-7` and `image-9` have no marks on them but no provenance
either, so treat them the same way until someone can say where they came from.

**Get a licence for each, or replace it.** Replacing is cheap: every one of
these is a simple two-tone mark, the pipeline turns any similar artwork into a
matching emblem in one command, and the diagram's geometry does not care which
mark sits in which box. Doing it before launch is a great deal cheaper than
after.

`image-1`, `image-2`, `image-10`, `image-11` and both logos carry no
third-party marks, but only the logos are known to be the practice's own.
