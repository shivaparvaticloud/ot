#!/usr/bin/env node
/**
 * verify.js — the pre-deploy gate for Simple Roots Therapy.
 *
 *   node scripts/verify.js
 *
 * Serves public/ locally with the real _headers applied, drives it in a
 * headless browser, and runs every check the project has established.
 * Exits 1 on any failure so it can gate a deploy.
 *
 * Writes verify-report.json alongside the readable table.
 * See docs/VERIFY.md.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { start, loadChromium, PAGES, ROOT, PUBLIC } = require('./lib/server');

const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;
const WEIGHT_BUDGET = 100 * 1024; // bytes per page, all assets included

const WIDTHS = [320, 360, 390, 414, 600, 768, 1024, 1280, 1440, 1920];

// ---------------------------------------------------------------- results
const results = [];
function record(check, page, pass, detail) {
  results.push({ check, page, pass, detail: detail || '' });
}

// ---------------------------------------------------------------- in-page probes
/* Runs inside the browser. Returns everything derivable from one render. */
const PROBE = () => {
  const out = { contrast: [], dupIds: [], nameless: [], imgNoAlt: [], svgUnlabelled: [],
    headings: [], targets: [] };

  const seen = {};
  document.querySelectorAll('[id]').forEach(e => { seen[e.id] = (seen[e.id] || 0) + 1; });
  out.dupIds = Object.keys(seen).filter(k => seen[k] > 1);

  document.querySelectorAll('a,button').forEach(e => {
    const n = (e.textContent || '').trim() || e.getAttribute('aria-label') || e.getAttribute('title');
    if (!n) out.nameless.push(e.outerHTML.slice(0, 80));
  });

  document.querySelectorAll('img').forEach(e => {
    if (!e.hasAttribute('alt')) out.imgNoAlt.push(e.getAttribute('src') || '(inline)');
  });

  document.querySelectorAll('svg').forEach(e => {
    const hidden = e.getAttribute('aria-hidden') === 'true';
    const labelled = e.hasAttribute('aria-labelledby') || e.hasAttribute('aria-label');
    if (!hidden && !labelled) out.svgUnlabelled.push(e.outerHTML.slice(0, 60));
  });

  out.headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .map(e => +e.tagName[1]);

  // contrast, against the nearest opaque ancestor background
  const lum = c => { const v = c.map(x => { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = el => { let n = el; while (n && n !== document.documentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.95) return c.rgb; n = n.parentElement; } const c = parse(getComputedStyle(document.body).backgroundColor); return c ? c.rgb : [255, 255, 255]; };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); };

  [...document.querySelectorAll('body *')].forEach(e => {
    if (!e.offsetParent && getComputedStyle(e).position !== 'fixed') return;
    const direct = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!direct) return;
    const cs = getComputedStyle(e);
    const fg = parse(cs.color); if (!fg) return;
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const r = ratio(fg.rgb, bgOf(e));
    if (r < need) out.contrast.push(`${r.toFixed(2)}:1 (needs ${need}) "${e.textContent.trim().slice(0, 34)}"`);
  });

  // target size, exempting links whose size is constrained by surrounding prose
  document.querySelectorAll('a,button').forEach(e => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.height >= 24 && r.width >= 24) return;
    const parent = e.parentElement;
    const inline = parent && /^(P|LI|TD|DD|SPAN|EM|STRONG)$/.test(parent.tagName)
      && parent.textContent.trim().length > e.textContent.trim().length * 1.2;
    if (inline) return; // WCAG 2.2 SC 2.5.8 inline exception
    out.targets.push(`${Math.round(r.width)}x${Math.round(r.height)} "${e.textContent.trim().slice(0, 24)}"`);
  });

  return out;
};

// ---------------------------------------------------------------- main
(async () => {
  const server = await start(PORT);
  const chromium = loadChromium();
  const browser = await chromium.launch();

  // ---- static checks, no browser needed
  const files = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html'));
  const ids = {};
  for (const f of files) ids[f] = new Set([...fs.readFileSync(path.join(PUBLIC, f), 'utf8')
    .matchAll(/id="([^"]+)"/g)].map(m => m[1]));

  for (const f of files) {
    const s = fs.readFileSync(path.join(PUBLIC, f), 'utf8');
    const page = '/' + f;

    // head requirements
    const need = {
      lang: /<html[^>]+lang="[^"]+"/.test(s),
      title: /<title>[^<]{5,}<\/title>/.test(s),
      description: /<meta name="description" content="[^"]{20,}"/.test(s),
      canonical: /<link rel="canonical" href="https?:[^"]+"/.test(s),
    };
    const missing = Object.entries(need).filter(([, v]) => !v).map(([k]) => k);
    record('head metadata', page, missing.length === 0, missing.length ? `missing: ${missing}` : '');

    // internal links resolve
    const bad = [];
    for (const m of s.matchAll(/href="([^"]+)"/g)) {
      const href = m[1];
      if (/^(https?:|mailto:|tel:)/.test(href)) continue;
      const [p, frag] = href.split('#');
      const target = (p === '/' || p === '') ? 'index.html' : p.replace(/^\//, '');
      if (p && !fs.existsSync(path.join(PUBLIC, target))) bad.push(`missing file ${href}`);
      else if (frag && ids[target] && !ids[target].has(frag)) bad.push(`missing anchor ${href}`);
    }
    record('internal links', page, bad.length === 0, bad.join('; '));

  }

  // unfilled placeholders — every text asset, not just HTML.
  // Matches any single-line [BRACKETED] token, then drops the two things
  // that legitimately look like one: markdown links [label](url) in llms.txt,
  // and JSON/CSS fragments containing a quote.
  const TEXT_EXT = new Set(['.html', '.txt', '.xml', '.webmanifest']);
  const textFiles = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (TEXT_EXT.has(path.extname(e.name)) || e.name === 'security.txt') textFiles.push(full);
    }
  })(PUBLIC);

  for (const full of textFiles) {
    const rel = '/' + path.relative(PUBLIC, full);
    const s = fs.readFileSync(full, 'utf8');
    const found = new Set();
    for (const m of s.matchAll(/\[([^[\]\n]{1,60})\]/g)) {
      const body = m[1];
      const after = s[m.index + m[0].length];
      if (after === '(') continue;      // markdown link
      if (body.includes('"')) continue; // JSON or attribute selector
      found.add(m[0]);
    }
    record('no placeholders', rel, found.size === 0, [...found].join(' '));
  }

  // ---- browser checks
  for (const p of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pg = await ctx.newPage();
    const errs = [], reqs = [];
    let bytes = 0;
    pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    pg.on('request', r => reqs.push(r.url()));
    pg.on('response', async r => {
      try { const b = await r.body(); bytes += b.length; } catch (_) {}
    });
    await pg.goto(BASE + p, { waitUntil: 'networkidle' });

    const probe = await pg.evaluate(PROBE);
    record('contrast', p, probe.contrast.length === 0, probe.contrast.slice(0, 3).join('; '));
    record('duplicate ids', p, probe.dupIds.length === 0, probe.dupIds.join(', '));
    record('accessible names', p, probe.nameless.length === 0, probe.nameless.slice(0, 2).join('; '));
    record('image alt', p, probe.imgNoAlt.length === 0, probe.imgNoAlt.join(', '));
    record('svg labelled/hidden', p, probe.svgUnlabelled.length === 0, probe.svgUnlabelled.join('; '));
    record('target size', p, probe.targets.length === 0, probe.targets.slice(0, 3).join('; '));

    const h = probe.headings;
    const h1s = h.filter(x => x === 1).length;
    const skips = h.map((x, i) => i && x > h[i - 1] + 1 ? `h${h[i - 1]}>h${x}` : null).filter(Boolean);
    record('heading structure', p, h1s === 1 && skips.length === 0,
      `${h1s} h1${skips.length ? ', skips: ' + skips.join(',') : ''}`);

    const external = reqs.filter(u => !u.startsWith(BASE));
    record('zero external requests', p, external.length === 0, external.join(', '));

    const csp = errs.filter(e => /Content Security Policy|Refused to/i.test(e));
    record('zero CSP violations', p, csp.length === 0, csp.slice(0, 2).join('; '));

    record('page weight', p, bytes <= WEIGHT_BUDGET,
      `${(bytes / 1024).toFixed(1)} KB of ${(WEIGHT_BUDGET / 1024)} KB budget`);

    // CLS
    const cls = await pg.evaluate(() => new Promise(res => {
      let total = 0;
      try {
        new PerformanceObserver(list => {
          for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (_) { return res(0); }
      setTimeout(() => res(total), 600);
    }));
    record('CLS is zero', p, cls === 0, `CLS ${cls.toFixed(4)}`);

    // overflow across widths
    const over = [];
    for (const w of WIDTHS) {
      await pg.setViewportSize({ width: w, height: 900 });
      const r = await pg.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }));
      if (r.d > r.w + 1) over.push(`${w}px (${r.d})`);
    }
    record('no horizontal overflow', p, over.length === 0, over.join(', '));
    await ctx.close();

    // 200% zoom — half the viewport at 2x DPR is the standard equivalent
    const zctx = await browser.newContext({ viewport: { width: 640, height: 512 }, deviceScaleFactor: 2 });
    const zp = await zctx.newPage();
    await zp.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    const z = await zp.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }));
    record('200% zoom reflow', p, z.d <= z.w + 1, z.d > z.w + 1 ? `${z.d} > ${z.w}` : '');
    await zctx.close();

    // WCAG 1.4.12 text spacing
    const tctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const tp = await tctx.newPage();
    await tp.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    await tp.addStyleTag({ content: `*{line-height:1.5!important;letter-spacing:0.12em!important;word-spacing:0.16em!important}p{margin-bottom:2em!important}` });
    const t = await tp.evaluate(() => ({ d: document.documentElement.scrollWidth, w: window.innerWidth }));
    record('text-spacing override', p, t.d <= t.w + 1, t.d > t.w + 1 ? `${t.d} > ${t.w}` : '');
    await tctx.close();

    // reduced motion leaves nothing hidden
    const rctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const rp = await rctx.newPage();
    await rp.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    const hidden = await rp.evaluate(() => {
      const out = [];
      document.querySelectorAll('body *').forEach(e => {
        const cs = getComputedStyle(e);
        if (cs.animationName !== 'none') return;
        const o = parseFloat(cs.opacity);
        const decorative = e.classList.contains('pl-fill') || e.classList.contains('pl-core');
        if (o < 0.99 && !decorative && e.textContent.trim()) out.push(e.className || e.tagName);
      });
      const line = document.querySelector('.demand-line');
      if (line && parseFloat(getComputedStyle(line).strokeDashoffset) !== 0) out.push('demand-line dashoffset');
      return out.slice(0, 4);
    });
    record('reduced motion', p, hidden.length === 0, hidden.join(', '));
    await rctx.close();

    // forced dark must be pixel-identical
    const shots = [];
    for (const scheme of ['light', 'dark']) {
      const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
      const q = await c.newPage();
      await q.goto(BASE + p, { waitUntil: 'networkidle' });
      shots.push(await q.screenshot({ fullPage: true }));
      await c.close();
    }
    const identical = shots[0].equals(shots[1]);
    record('light under forced dark', p, identical, identical ? '' : 'renders differently in dark mode');
  }

  await browser.close();
  server.close();

  // ---------------------------------------------------------------- report
  const byCheck = new Map();
  for (const r of results) {
    if (!byCheck.has(r.check)) byCheck.set(r.check, []);
    byCheck.get(r.check).push(r);
  }
  const failures = results.filter(r => !r.pass);

  console.log('\n  Simple Roots Therapy — pre-deploy verification\n');
  console.log(`  ${'check'.padEnd(28)}${'pages'.padEnd(8)}result`);
  console.log('  ' + '-'.repeat(60));
  for (const [check, rows] of byCheck) {
    const bad = rows.filter(r => !r.pass);
    const mark = bad.length === 0 ? 'PASS' : `FAIL (${bad.length})`;
    console.log(`  ${check.padEnd(28)}${String(rows.length).padEnd(8)}${mark}`);
  }

  if (failures.length) {
    console.log('\n  Failures\n  ' + '-'.repeat(60));
    for (const f of failures) {
      console.log(`  ${f.check} — ${f.page}`);
      if (f.detail) console.log(`      ${f.detail}`);
    }
  }

  const summary = {
    generated: new Date().toISOString(),
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    budgetBytes: WEIGHT_BUDGET,
    checks: [...byCheck.keys()],
    failures: failures.map(f => ({ check: f.check, page: f.page, detail: f.detail })),
  };
  fs.writeFileSync(path.join(ROOT, 'verify-report.json'), JSON.stringify(summary, null, 2));

  console.log(`\n  ${summary.passed}/${summary.total} passed. Report: verify-report.json\n`);
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
