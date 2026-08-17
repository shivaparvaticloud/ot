#!/usr/bin/env node
/**
 * visual-diff.js — visual regression for Simple Roots Therapy.
 *
 *   node scripts/visual-diff.js            compare against the baseline
 *   node scripts/visual-diff.js --update   replace the baseline deliberately
 *
 * Captures every page at three widths in three rendering modes, compares
 * against tests/baseline/, and reports differing pixels and where they are.
 * Exits 1 if any page exceeds the threshold.
 *
 * See docs/VISUAL-REGRESSION.md.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { start, loadChromium, PAGES, ROOT, nameFor } = require('./lib/server');

const PORT = 8124;
const BASE = `http://127.0.0.1:${PORT}`;
const BASELINE = path.join(ROOT, 'tests', 'baseline');
const DIFFDIR = path.join(ROOT, 'tests', 'diff');

const WIDTHS = [390, 768, 1440];
const MODES = {
  default:  {},
  motion:   { reducedMotion: 'reduce' },
  contrast: { forcedColors: 'active' },
};

/* A changed pixel is one where any channel moves more than this. Text
   antialiasing shifts a channel by a few units between otherwise identical
   renders; a real colour or layout change moves it far further. */
const CHANNEL_TOLERANCE = 12;
/* Fail the page if more than this share of pixels changed. Antialiasing
   noise across a long page stays well under 0.05%; a moved block or a
   changed token is over 0.5% immediately. */
const FAIL_ABOVE_PCT = 0.1;

const update = process.argv.includes('--update');

/* Compare two PNG buffers by decoding them in the browser — avoids adding
   an image library, which would be a dependency for a repo that has none. */
const COMPARE = async ([a, b, tol]) => {
  const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
  const draw = img => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#FF00FF'; x.fillRect(0, 0, w, h); // padding shows as a difference
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, w, h).data;
  };
  const da = draw(ia), db = draw(ib);
  let diff = 0, minX = w, minY = h, maxX = -1, maxY = -1;
  const mask = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < da.length; i += 4) {
    const changed = Math.abs(da[i] - db[i]) > tol
      || Math.abs(da[i + 1] - db[i + 1]) > tol
      || Math.abs(da[i + 2] - db[i + 2]) > tol;
    const px = (i / 4) % w, py = Math.floor((i / 4) / w);
    if (changed) {
      diff++;
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
      mask[i] = 255; mask[i + 1] = 0; mask[i + 2] = 128; mask[i + 3] = 255;
    } else {
      const g = 235;
      mask[i] = g; mask[i + 1] = g; mask[i + 2] = g; mask[i + 3] = 255;
    }
  }
  let dataUrl = null;
  if (diff) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').putImageData(new ImageData(mask, w, h), 0, 0);
    dataUrl = c.toDataURL('image/png');
  }
  return {
    w, h, diff, total: w * h,
    sizeChanged: ia.width !== ib.width || ia.height !== ib.height,
    box: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    dataUrl,
  };
};

(async () => {
  fs.mkdirSync(BASELINE, { recursive: true });
  // Clear old masks. They used to accumulate across runs, so the directory
  // could hold a mask for a page that passed this time — which is actively
  // misleading when you open one to work out what moved.
  fs.rmSync(DIFFDIR, { recursive: true, force: true });
  const server = await start(PORT);
  const chromium = loadChromium();
  const browser = await chromium.launch();

  const shots = new Map();
  for (const [mode, opts] of Object.entries(MODES)) {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 }, deviceScaleFactor: 1, ...opts,
      });
      const pg = await ctx.newPage();
      for (const p of PAGES) {
        await pg.goto(BASE + p, { waitUntil: 'networkidle' });
        /* Let the entrance animation finish, or the capture is taken
           mid-flight and is not reproducible. This applies to every mode
           except reduced-motion: forced-colors does NOT imply reduced
           motion, so those pages animate too. Getting this wrong made the
           forced-colors captures of the two animated pages differ on every
           run. */
        if (mode !== 'motion') await pg.waitForTimeout(2500);
        const key = `${nameFor(p)}-${width}-${mode}.png`;
        shots.set(key, await pg.screenshot({ fullPage: true }));
      }
      await ctx.close();
    }
  }

  if (update) {
    for (const f of fs.readdirSync(BASELINE)) fs.unlinkSync(path.join(BASELINE, f));
    for (const [key, buf] of shots) fs.writeFileSync(path.join(BASELINE, key), buf);
    await browser.close(); server.close();
    const bytes = [...shots.values()].reduce((a, b) => a + b.length, 0);
    console.log(`\n  Baseline updated: ${shots.size} images, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    console.log('  Review the diff before committing — this is now the reference.\n');
    process.exit(0);
  }

  const ctx = await browser.newContext();
  const cmp = await ctx.newPage();
  const rows = [];
  let failed = 0, missing = 0;

  for (const [key, buf] of shots) {
    const ref = path.join(BASELINE, key);
    if (!fs.existsSync(ref)) { rows.push({ key, note: 'NO BASELINE' }); missing++; continue; }
    const r = await cmp.evaluate(COMPARE, [
      'data:image/png;base64,' + fs.readFileSync(ref).toString('base64'),
      'data:image/png;base64,' + buf.toString('base64'),
      CHANNEL_TOLERANCE,
    ]);
    const pct = (r.diff / r.total) * 100;
    const bad = pct > FAIL_ABOVE_PCT;
    if (bad) {
      failed++;
      fs.mkdirSync(DIFFDIR, { recursive: true });
      if (r.dataUrl) {
        fs.writeFileSync(path.join(DIFFDIR, key),
          Buffer.from(r.dataUrl.split(',')[1], 'base64'));
      }
    }
    if (r.diff) rows.push({ key, diff: r.diff, pct, box: r.box, sizeChanged: r.sizeChanged, bad });
  }
  await ctx.close();
  await browser.close();
  server.close();

  console.log('\n  Visual regression — ' + shots.size + ' captures '
    + `(${PAGES.length} pages x ${WIDTHS.length} widths x ${Object.keys(MODES).length} modes)\n`);
  console.log(`  tolerance: ${CHANNEL_TOLERANCE}/channel, fail above ${FAIL_ABOVE_PCT}% of pixels\n`);

  if (!rows.length) {
    console.log('  No differences at all. Every capture is byte-comparable to the baseline.\n');
  } else {
    console.log(`  ${'capture'.padEnd(34)}${'pixels'.padEnd(11)}${'%'.padEnd(9)}region`);
    console.log('  ' + '-'.repeat(78));
    for (const r of rows) {
      if (r.note) { console.log(`  ${r.key.padEnd(34)}${r.note}`); continue; }
      const region = r.box ? `x${r.box.x} y${r.box.y} ${r.box.w}x${r.box.h}` : '-';
      const flag = r.bad ? '  <-- FAIL' : '  (within tolerance)';
      console.log(`  ${r.key.padEnd(34)}${String(r.diff).padEnd(11)}${r.pct.toFixed(3).padEnd(9)}${region}${flag}`);
      if (r.sizeChanged) console.log('      page height changed — layout, not just colour');
    }
    if (failed) console.log(`\n  Diff images written to tests/diff/`);
  }

  console.log(`\n  ${shots.size - failed - missing}/${shots.size} within tolerance`
    + (missing ? `, ${missing} with no baseline` : '') + '\n');
  process.exit(failed || missing ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
