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

function parseHeaders() {
  const file = path.join(PUBLIC, '_headers');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (/^\s+\S/.test(line) && line.includes(':')) {
      const i = line.indexOf(':');
      out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return out;
}

function start(port) {
  const headers = parseHeaders();
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(PUBLIC, p);
      const send = (code, body, type) => {
        for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
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

module.exports = { start, loadChromium, parseHeaders, PAGES, ROOT, PUBLIC, nameFor };
