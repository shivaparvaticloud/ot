#!/usr/bin/env python3
"""
prepare-images.py — one-off asset preparation. NOT part of the deploy path.

The site itself still has no build step: `public/` is uploaded as-is. This
script exists so the route from the supplied artwork in `assets/source-images/`
to the web assets in `public/images/` is reproducible and reviewable, rather
than a set of undocumented manual exports.

    pip install Pillow numpy
    python3 scripts/prepare-images.py

Three things it does, and why each one matters here:

1. SEPARATES EACH MARK FROM ITS OWN BACKGROUND.
   The artwork arrives on a dozen different grounds — olive, forest green,
   kraft paper, pale yellow, four shades of off-white. Dropped onto the site's
   linen as rectangles they would read as a mood board, not a diagram. Each
   mark is cut out by colour distance from its background, not by luminance:
   image-9 is coral on pale yellow, which no luminance threshold can separate.

2. EMITS THE MOTIFS AS GREYSCALE MASKS, NOT COLOURED IMAGES.
   `public/images/*.png` are luminance masks — white where the ink is. The
   colour is applied in CSS/SVG by the element the mask is applied to, which
   buys three things a coloured PNG cannot: the palette stays in styles.css
   where the rest of the palette lives, Windows High Contrast mode can
   substitute its own colour, and a one-channel PNG is roughly a third of the
   size of the RGBA equivalent. That last point is what keeps the home page
   inside its weight budget with eleven images on it.

3. CROPS AWAY CAPTIONS AND THIRD-PARTY WORDMARKS.
   Via the CROP boxes below rather than by hand, so a re-run cannot silently
   reintroduce them. See docs/IMAGES.md — cropping a wordmark out does not
   resolve the licensing question underneath it, and several of these still
   need clearing before launch.

Everything is emitted at roughly 2x the largest size the layout can ask for,
so the marks stay crisp on high-density displays without carrying pixels the
page can never use.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'source-images'
OUT = ROOT / 'public' / 'images'
ICONS = ROOT / 'public'

# The icon is a flattened PNG rather than a mask, so it carries real colour.
# LOGO_INK is sampled from the supplied artwork, not invented: 7.4:1 on linen.
LOGO_INK = (0x7A, 0x3B, 0x43)
LINEN = (0xF7, 0xF5, 0xF0)

# Regions dropped before the mark is measured: printed captions, and wordmarks
# belonging to whoever originally published the artwork. Boxes are
# (left, top, right, bottom) in source pixels.
CROP = {
    'image-4.png': (0, 0, 1200, 950),        # drops the "UNITY" caption block
    'image-5.png': (0, 0, 735, 555),         # drops the HOMA MYKONOS wordmark
    'image-6.png': (0, 0, 563, 450),         # drops the studio watermark
    'vertical-logo.png': (0, 0, 1284, 558),  # mark only — the icon is square
}

# name -> (source, long edge in px, alpha ramp, ink weight)
#
# The ramp is (lo, hi) as a fraction of full ink distance. Artwork on textured
# paper needs a higher floor so the grain does not survive as a grey haze.
#
# The ink weight is a gamma applied after the mark is scaled down, and below 1
# it darkens. Solid silhouettes do not need it. Fine line work does: the big
# tree is drawn as thousands of individual leaf strokes, and averaging those
# down to 240px leaves a pale grey cloud that reads as a smudge beside the
# solid marks. Correcting it at the ramp instead would only thicken the
# strokes at full size and still wash out once scaled.
JOBS = {
    'logo-wide':       ('wide-logo.png',    520, (0.30, 0.62), 1.0),
    'self-figure':     ('image-1.jpg',      260, (0.20, 0.52), 0.85),
    'self-seated':     ('image-11.jpg',     100, (0.22, 0.55), 1.0),
    'env-tree':        ('image-3.png',      240, (0.12, 0.40), 0.45),
    'env-sapling':     ('image-2.png',      124, (0.18, 0.50), 0.65),
    'others-reaching': ('image-6.png',      124, (0.20, 0.55), 1.0),
    'others-family':   ('image-4.png',      132, (0.20, 0.55), 1.0),
    'others-circle':   ('image-5.png',      120, (0.20, 0.55), 0.8),
    'others-hands':    ('image-7.png',      116, (0.18, 0.50), 1.0),
    'others-holding':  ('image-8.png',      124, (0.18, 0.50), 1.0),
    'others-pair':     ('image-9.png',      108, (0.18, 0.50), 1.0),
    'tick':            ('image-10.jpg',     128, (0.18, 0.50), 1.0),
}

# The square icons are all cut from the vertical logo. This deliberately sits
# outside JOBS: the icons are flattened colour PNGs built from this mask in
# memory, so the mask itself is an intermediate. Putting it in JOBS would write
# it into public/images/ and deploy 26 KB that no page ever asks for.
ICON_SOURCE = ('vertical-logo.png', 512, (0.30, 0.62), 1.0)

ICON_SIZES = {
    'favicon-32.png': 32,
    'apple-touch-icon.png': 180,
    'icon-192.png': 192,
    'icon-512.png': 512,
}


def background(a):
    """Median colour of a 2%-wide border frame."""
    h, w, _ = a.shape
    m = max(2, int(min(h, w) * 0.02))
    edge = np.concatenate([
        a[:m].reshape(-1, 3), a[-m:].reshape(-1, 3),
        a[:, :m].reshape(-1, 3), a[:, -m:].reshape(-1, 3),
    ])
    return np.median(edge, axis=0)


def separate(source, lo, hi):
    """Cut the mark out of its background. Returns a trimmed float mask, 0..1."""
    im = Image.open(SRC / source).convert('RGB')
    if source in CROP:
        im = im.crop(CROP[source])
    a = np.asarray(im, dtype=np.float32)

    d = np.linalg.norm(a - background(a), axis=2)
    t = np.clip(np.clip(d / np.percentile(d, 99.5), 0, 1) - lo, 0, None) / (hi - lo)
    t = np.clip(t, 0, 1)
    mask = t * t * (3 - 2 * t)                     # smoothstep

    ys, xs = np.where(mask > 0.30)                 # trim to the mark itself
    if len(xs) == 0:
        raise SystemExit(f'{source}: no mark found')
    return mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def fit(mask, long_edge, weight=1.0):
    """Greyscale image of the mask, scaled so its long edge is long_edge.

    The weight gamma is applied after scaling, because it is the scaling that
    thins the line work — correcting before would be undone by the resample.
    """
    h, w = mask.shape
    scale = min(1.0, long_edge / max(w, h))
    img = Image.fromarray((mask * 255).astype(np.uint8), 'L')
    if scale < 1.0:
        img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    if weight != 1.0:
        a = np.asarray(img, dtype=np.float32) / 255.0
        img = Image.fromarray((np.power(a, weight) * 255).astype(np.uint8), 'L')
    return img


def build_icons(mark):
    """Square app icons: the logo mark inked on an opaque linen ground.

    Opaque rather than transparent because a maroon mark on a dark browser
    tab strip would measure about 2:1. On its own linen square it is 7.4:1
    wherever the icon ends up.
    """
    for name, size in ICON_SIZES.items():
        inner = round(size * 0.82)
        m = mark.copy()
        m.thumbnail((inner, inner), Image.LANCZOS)
        tile = Image.new('RGB', (size, size), LINEN)
        ink = Image.new('RGB', m.size, LOGO_INK)
        tile.paste(ink, ((size - m.width) // 2, (size - m.height) // 2), m)
        # Two colours and the antialiasing between them: a 64-entry palette is
        # indistinguishable from truecolour here and a quarter of the bytes.
        tile = tile.quantize(colors=64, method=Image.MEDIANCUT, dither=Image.NONE)
        dest = ICONS / name
        tile.save(dest, optimize=True)
        yield dest, size, size, dest.stat().st_size


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows, total = [], 0

    for name, (source, long_edge, ramp, weight) in JOBS.items():
        img = fit(separate(source, *ramp), long_edge, weight)
        dest = OUT / f'{name}.png'
        img.save(dest, optimize=True)
        size = dest.stat().st_size
        total += size
        rows.append((f'images/{dest.name}', img.width, img.height, size, source))

    icon_src, icon_edge, icon_ramp, icon_weight = ICON_SOURCE
    mark = fit(separate(icon_src, *icon_ramp), icon_edge, icon_weight)
    for dest, w, h, size in build_icons(mark):
        total += size
        rows.append((dest.name, w, h, size, icon_src))

    for name, w, h, size, src in rows:
        print(f'  {name:26s} {w:4d}x{h:<4d} {size / 1024:7.1f} KB   <- {src}')
    print(f'  {"total":26s} {"":9s} {total / 1024:7.1f} KB')


if __name__ == '__main__':
    sys.exit(main())
