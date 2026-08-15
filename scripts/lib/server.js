'use strict';
/**
 * Shared static server for the verification scripts.
 *
 * Serves public/ with the real headers from public/_headers applied, so
 * checks run against the same CSP the deployed site sends. Used by both
 * verify.js and visual-diff.js.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

/**
 * Read _headers into [pattern, headers] pairs, keeping each block with the
 * path it belongs to. Cloudflare applies every matching block in order, so
 * `/*` supplies the baseline and a narrower block layers on top.
 *
 * Grouping matters as soon as a block carries something that must not leak:
 * /images/* sets X-Robots-Tag: noindex, and flattening the file would stamp
 * that on every page of the local site.
 */
function parseHeaders() {
  const file = path.join(PUBLIC, '_headers');
  if (!fs.existsSync(file)) return [];
  const blocks = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    if (/^\S/.test(line)) {
      blocks.push([line.trim(), {}]);
    } else if (blocks.length && line.includes(':')) {
      const i = line.indexOf(':');
      blocks[blocks.length - 1][1][line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return blocks;
}

/** Cloudflare's matcher: a literal path, optionally ending in a `*` wildcard. */
function headersFor(blocks, urlPath) {
  const out = {};
  for (const [pattern, headers] of blocks) {
    const hit = pattern.endsWith('*')
      ? urlPath.startsWith(pattern.slice(0, -1))
      : urlPath === pattern;
    if (hit) Object.assign(out, headers);
  }
  return out;
}

function start(port) {
  const blocks = parseHeaders();
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(PUBLIC, p);
      const send = (code, body, type) => {
        for (const [k, v] of Object.entries(headersFor(blocks, p))) res.setHeader(k, v);
        res.writeHead(code, { 'Content-Type': type });
        res.end(body);
      };
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        const nf = path.join(PUBLIC, '404.html');
        return send(404, fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found',
          'text/html; charset=utf-8');
      }
      send(200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function loadChromium() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright']) {
    try { return require(c).chromium; } catch (_) { /* keep looking */ }
  }
  console.error('Could not load Playwright. Install it with:  npm i -D playwright');
  console.error('This is dev tooling only — the deployed site has no dependencies.');
  process.exit(2);
}

const PAGES = ['/', '/about.html', '/services.html', '/sessions-and-fees.html',
  '/faqs.html', '/contact.html', '/privacy.html', '/terms.html', '/404.html'];

const nameFor = p => (p === '/' ? 'index' : p.replace(/^\//, '').replace(/\.html$/, ''));

module.exports = { start, loadChromium, parseHeaders, headersFor, PAGES, ROOT, PUBLIC, nameFor };
