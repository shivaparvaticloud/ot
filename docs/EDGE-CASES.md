# Edge cases

```
node scripts/edge-cases.js
```

Exits **0** if everything passes, **1** on any failure, **2** if it could not
run. Takes about two minutes.

`verify.js` checks the site as it is normally encountered. This checks it
under conditions that are unusual but real.

## What it covers

| Check | Why |
|---|---|
| 320px viewport | The WCAG 1.4.10 reflow floor. Asserted. |
| 240px and 280px | Below any current device. Reported as notes, not failures — they surface fixed minimums early. |
| Root font 20px and 24px, at 320/360/390 | A visitor who has raised their default font size. Every `rem` grows with it, including ones acting as minimums. |
| 400% zoom | WCAG 1.4.10, as 320 CSS px at DPR 4. |
| Stylesheet fails to load | The document must still be readable and ordered. |
| Logo 404s | Alt text replaces the image and must not blow out the hero. |
| Landscape phone, 360px tall | The sticky CTA must not eat the viewport. |

## What it found on the first run

Ten failures across four causes. All four were the same underlying mistake in
different clothes: **a fixed length used as a minimum, in a place that does
not know how much room it has.**

### Grid tracks with a bare rem minimum

```css
grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));   /* .cards */
grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));   /* .pillar-notes */
```

`auto-fit` still lays out a 16rem track when the container is narrower than
16rem, and the grid overflows. It never showed up at the default font size
because 16rem is 256px there and the column is wider than that. At a 24px
root it is 384px, and the page scrolls sideways.

Fixed with `minmax(min(16rem, 100%), 1fr)`, which lets the track collapse to
the container.

Two other grids use `minmax(0, 15rem)` and `minmax(0, 13rem)`. Those are
safe — the rem is the *maximum* there, and the minimum is already zero.

### An SVG floor larger than the column

`.pillars svg` carried `min-inline-size: 280px` so the diagram would not
shrink to illegibility. At a 320px viewport the content column is exactly
280px, so it fit with nothing to spare — and when the visitor's font size
grew, the gutter grew with it, the column dropped below 280px, and the page
overflowed by 46px.

Fixed with `min(280px, 100%)`. An illegibly small diagram is a much smaller
problem than a page that scrolls sideways.

### `white-space: nowrap` on a long label

`.legend .key` kept each swatch beside its whole label. "What you have
available that day" cannot fit on one line at a large font size, so it pushed
the page out instead. Now `inline-flex`, which keeps the swatch attached to
the label while letting the label wrap.

### Unbreakable tokens

`contact@simplerootstherapy.com.au` is a single token 350px wide at a 24px
root. Now `overflow-wrap: anywhere` on mailto and http links, with
`break-word` as a baseline on `body`.

`anywhere` rather than `break-word` on the links specifically: only
`anywhere` reduces min-content width, and min-content width is the figure a
grid or flex track measures when deciding how wide to be. `break-word` would
have let the text wrap visually while the track still reserved the full
unbroken width.

## The pattern worth remembering

Three of the four were invisible at the default font size and appeared only
when the root font grew. A `rem` minimum is not a small number — it is a
number that scales with a setting the visitor controls, and it can quietly
become larger than the space it sits in.

When a length acts as a floor, ask what happens when the container is smaller
than the floor. If the answer is "it overflows", wrap it in `min(…, 100%)`.

## Combinations matter

The 320px-viewport-with-24px-font bug was missed by testing narrow viewports
and large fonts separately — each passed alone. It only appeared when both
applied at once. The suite now tests the raised font size at three widths
rather than one.
