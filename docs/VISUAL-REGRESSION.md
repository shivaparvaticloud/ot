# Visual regression

```
node scripts/visual-diff.js            # compare against the baseline
node scripts/visual-diff.js --update   # replace the baseline, deliberately
```

Exits **0** if every capture is within tolerance, **1** if any page differs or
has no baseline, **2** if the script could not run.

Captures **81 images**: 9 pages × 3 widths (390, 768, 1440) × 3 modes
(default, reduced-motion, forced-colors). Full-page, `deviceScaleFactor: 1`,
served with the real `_headers` on port 8124.

A run takes roughly three and a half minutes, most of it the 2.5-second
settle applied to every non-reduced-motion capture.

## Tolerance, and what it is calibrated for

- **12 per channel.** A pixel counts as changed only if red, green or blue
  moves more than 12. Text antialiasing between otherwise identical renders
  moves a channel by a few units.
- **Fails above 0.1% of pixels.** Below that it is reported but not failed.

This was characterised with two deliberate changes rather than guessed:

| Deliberate change | Result | Diff |
|---|---|---|
| `--radius-md` 3px → 6px (card corners only) | **reported, not failed** | 45–363 px, 0.002–0.029% |
| `--space-lg` 1rem → 1.125rem (paragraph rhythm) | **failed on every page** | 12.6–19.2% |

So: **anything that moves layout or changes a colour fails immediately.** A
purely local cosmetic tweak of a few hundred pixels is listed with its
region but passes. That is deliberate — a threshold tight enough to fail on
300 pixels would fail on font-rendering noise between machines — but it means
you should read the reported rows, not just the exit code. Any non-zero row is
worth a glance even when the run is green.

## Output

Each differing capture reports the pixel count, the percentage, and the
bounding box of the changed region, so you can tell a footer change from a
hero change without opening the image:

```
index-390-contrast.png   5365   0.429   x20 y207 350x1190   <-- FAIL
```

Failing captures also write a mask to `tests/diff/`, magenta on grey, showing
exactly which pixels moved. `tests/diff/` is gitignored.

If a page's height changes, the row says so explicitly — that means layout
moved, not just colour.

## Updating the baseline

Only when a visual change is **intended**:

1. Make the change and confirm it is what you want.
2. Run `node scripts/verify.js` and make sure it still passes.
3. Run `node scripts/visual-diff.js` and **read the report**. Confirm every
   failing page is failing for the reason you expect.
4. Only then `node scripts/visual-diff.js --update`.
5. Commit the baseline change in its own commit, separate from the code
   change, with a message saying what moved and why.

Step 3 is the point of the tool. Updating the baseline without reading the
diff first turns a regression test into a rubber stamp.

## Two findings from building this

**Forced-colors does not imply reduced motion.** The first version of the
capture script only settled the animation for the `default` mode, so the
forced-colors captures of the two animated pages — index and services — were
taken mid-flight and differed on every run. Every mode except reduced-motion
now waits for the entrance sequence to finish. If you add a mode, it needs
that settle unless it disables animation.

**The reduced-motion mode is largely redundant.** Comparing the baseline by
hash, `default` and `motion` captures are **identical on 21 of 27**
page/width combinations. They differ only on index and services, the two
pages carrying animated SVG. That is the correct result — reduced motion
renders the same final state — and `verify.js` already asserts separately
that reduced motion leaves nothing hidden.

Forced-colors, by contrast, differs on **27 of 27**, so it is carrying real
information and the emulation is genuinely working.

## A third finding: compositing changes pixels without changing layout

Adding `view-transition-name` to `.masthead`, `.foot` and `.sticky-cta` failed
ten captures — every default and forced-colors capture of index and services —
with the whole footer marked as changed.

It was not a layout change. Measured at sub-pixel precision with the names on
and off, `.foot`, `.foot-meta`, `.urgent`, `.foot-nav`, the first footer link
and the document height are **identical to three decimal places**. What
changed is that `view-transition-name` creates a stacking context, the footer
is promoted to its own compositing layer, and that layer rasterises text with
slightly different snapping and antialiasing. Same position, same content,
different pixels.

Two things worth taking from it:

**Read the mask, not the row.** The bounding box said "footer", which could
equally have meant the footer moved. Only an A/B with the property toggled —
17,935 changed pixels with it on, matching the reported diff exactly —
identified the cause.

**Stale masks lie.** `tests/diff/` used to accumulate across runs, so it could
hold a mask for a page that passed this time. Opening one of those sent this
investigation down a wrong path for several minutes. The script now clears the
directory at the start of every run, so whatever is in it belongs to the run
you just did.

## Repository size — read this before the first update

The baseline is **22.8 MB across 81 PNGs**.

Git stores each binary version in full, so **every `--update` adds roughly
another 22 MB to history permanently**, whether or not most images changed.
Four updates and the repository is over 100 MB.

Options if that becomes a problem, in order of preference:

1. **Drop the `motion` mode.** It is redundant on 21 of 27 captures, as
   above, and `verify.js` covers the property it tests. Saves about a third.
2. **Drop the 768 width.** 390 and 1440 bracket the responsive range; 768 sits
   between two breakpoints and rarely fails alone.
3. **Track the baseline with Git LFS**, if the host supports it.
4. **Do not commit the baseline at all** — regenerate it on a known-good
   commit in CI and compare within the run. This loses the ability to review a
   baseline change in a pull request, which is a real cost.

It is committed as specified for now. Flagging the growth curve so the choice
is made deliberately rather than discovered at 200 MB.
