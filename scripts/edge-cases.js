#!/usr/bin/env node
'use strict';
/**
 * Edge-case suite.
 *
 * verify.js checks the site as it is normally encountered. This checks it
 * under conditions that are unusual but real: a visitor who has raised their
 * default font size, a phone narrower than the reflow floor, a stylesheet
 * that never arrives, an image that 404s, a landscape phone.
 *
 * Every check here was written because it found something. The four bugs it
 * caught on first run are listed in docs/EDGE-CASES.md.
 *
 * Exits 0 if everything passes, 1 on any failure, 2 if it could not run.
 */
const { start, loadChromium, PAGES, nameFor } = require('./lib/server.js');

const PORT = 8146;
const BASE = `http://127.0.0.1:${PORT}`;
const fails = [];
const note = (check, page, ok, detail) => {
  if (!ok) fails.push({ check, page, detail });
};

(async () => {
  const server = await start(PORT);
  const chromium = loadChromium();
  const browser = await chromium.launch();

  const widthOf = pg => pg.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
    worst: [...document.querySelectorAll('body *')].map(e => {
      const r = e.getBoundingClientRect();
      if (r.right <= window.innerWidth + 1) return null;
      const cls = (e.className && e.className.baseVal !== undefined)
        ? e.className.baseVal : e.className;
      return `${e.tagName}.${cls || ''} +${Math.round(r.right - window.innerWidth)}`;
    }).filter(Boolean)[0],
  }));

  // ---- Narrow viewports.
  // 320 is the WCAG 1.4.10 reflow floor and is asserted. 240 and 280 are
  // below any current device and are reported as warnings, not failures —
  // they are here because they surface fixed minimums early.
  for (const w of [240, 280, 320]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    const pg = await ctx.newPage();
    for (const p of PAGES) {
      await pg.goto(BASE + p, { waitUntil: 'domcontentloaded' });
      const r = await widthOf(pg);
      const ok = r.doc <= r.win + 1;
      if (w === 320) note('narrow 320', nameFor(p), ok, `${r.doc} > ${r.win}${r.worst ? ' | ' + r.worst : ''}`);
      else if (!ok) console.log(`  note: ${nameFor(p)} overflows at ${w}px (below the 320px floor) — ${r.worst || ''}`);
    }
    await ctx.close();
  }

  // ---- A raised default font size, at the narrowest supported width.
  // rem-based minimums grow with this, which is how three grid tracks and an
  // SVG floor came to push the page sideways. bypassCSP because addStyleTag
  // is inline and style-src is 'self'; a real user changes this in browser
  // settings, which is user-origin and exempt from page CSP.
  for (const [w, size] of [[320, 24], [360, 24], [390, 24], [390, 20]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, bypassCSP: true });
    const pg = await ctx.newPage();
    for (const p of PAGES) {
      await pg.goto(BASE + p, { waitUntil: 'domcontentloaded' });
      await pg.addStyleTag({ content: `html{font-size:${size}px!important}` });
      await pg.waitForTimeout(120);
      const r = await widthOf(pg);
      note(`root ${size}px @ ${w}`, nameFor(p), r.doc <= r.win + 1,
        `${r.doc} > ${r.win}${r.worst ? ' | ' + r.worst : ''}`);
    }
    await ctx.close();
  }

  // ---- 400% zoom: WCAG 1.4.10 wants the content usable at 320 CSS px.
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 256 }, deviceScaleFactor: 4 });
    const pg = await ctx.newPage();
    for (const p of PAGES) {
      await pg.goto(BASE + p, { waitUntil: 'domcontentloaded' });
      const r = await widthOf(pg);
      note('zoom 400%', nameFor(p), r.doc <= r.win + 1, `${r.doc} > ${r.win}`);
    }
    await ctx.close();
  }

  // ---- The stylesheet never arrives. The document must still be readable
  // and in a sensible order, because the content is what matters.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    await pg.route('**/styles.css', r => r.abort());
    for (const p of PAGES) {
      await pg.goto(BASE + p, { waitUntil: 'domcontentloaded' });
      const r = await pg.evaluate(() => ({
        h1: !!document.querySelector('h1'),
        len: document.body.innerText.length,
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
      }));
      note('no stylesheet', nameFor(p), r.h1 && r.len > 300, `h1=${r.h1} textLength=${r.len}`);
      note('no stylesheet overflow', nameFor(p), r.doc <= r.win + 1, `${r.doc} > ${r.win}`);
    }
    await ctx.close();
  }

  // ---- The logo 404s. Alt text replaces it and must not blow out the hero.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await ctx.newPage();
    await pg.route('**/logo-wide-*', r => r.abort());
    await pg.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(300);
    const r = await widthOf(pg);
    note('logo unavailable', 'index', r.doc <= r.win + 1, `${r.doc} > ${r.win}`);
    await ctx.close();
  }

  // ---- Landscape phone. The sticky CTA must not eat the viewport.
  {
    const ctx = await browser.newContext({ viewport: { width: 740, height: 360 } });
    const pg = await ctx.newPage();
    for (const p of PAGES) {
      await pg.goto(BASE + p, { waitUntil: 'domcontentloaded' });
      const frac = await pg.evaluate(() => {
        const cta = document.querySelector('.sticky-cta');
        return cta ? cta.getBoundingClientRect().height / window.innerHeight : 0;
      });
      note('landscape 360h', nameFor(p), frac < 0.25,
        `sticky CTA occupies ${(frac * 100).toFixed(0)}% of viewport height`);
    }
    await ctx.close();
  }

  await browser.close();
  server.close();

  console.log('\n  Edge cases\n  ' + '-'.repeat(58));
  if (!fails.length) {
    console.log('  all clear\n');
    process.exit(0);
  }
  for (const f of fails) console.log(`  ${f.check} — ${f.page}\n      ${f.detail}`);
  console.log(`\n  ${fails.length} failure${fails.length > 1 ? 's' : ''}\n`);
  process.exit(1);
})().catch(e => { console.error(e); process.exit(2); });
