'use strict';
/**
 * Contact-form Worker for Simple Roots Therapy.
 *
 * Static assets remain the default path: only /api/* is run through this
 * script, and every non-API request is handed back to the ASSETS binding.
 * The browser still has no JavaScript; the form is an ordinary POST followed
 * by a server redirect.
 */

const DESTINATION = 'contact@simplerootstherapy.com.au';
const SENDER = 'website@simplerootstherapy.com.au';
const MAX = { name: 100, email: 254, message: 5000 };

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; upgrade-insecure-requests",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=(), interest-cohort=()',
  'Cache-Control': 'no-store',
};

function redirect(path) {
  return new Response(null, {
    status: 303,
    headers: { ...SECURITY_HEADERS, Location: path },
  });
}

function methodNotAllowed() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { ...SECURITY_HEADERS, Allow: 'POST' },
  });
}

function sameOrigin(request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');

  if (origin && origin !== requestOrigin) return false;
  if (referer) {
    try {
      if (new URL(referer).origin !== requestOrigin) return false;
    } catch (_) {
      return false;
    }
  }
  return Boolean(origin || referer);
}

function cleanHeader(value) {
  return value.replace(/[\r\n]/g, ' ').trim();
}

function validForm(form) {
  const name = String(form.get('name') || '').trim();
  const email = String(form.get('email') || '').trim();
  const message = String(form.get('message') || '').trim();
  const honeypot = String(form.get('website') || '').trim();
  const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (honeypot || !name || !email || !message) return null;
  if (name.length > MAX.name || email.length > MAX.email ||
      message.length > MAX.message || !emailShape.test(email)) return null;
  return { name, email, message };
}

async function contact(request, env) {
  if (request.method !== 'POST') return methodNotAllowed();
  if (!sameOrigin(request)) return redirect('/form-error.html');

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    return redirect('/form-error.html');
  }

  let form;
  try {
    form = await request.formData();
  } catch (_) {
    return redirect('/form-error.html');
  }
  const fields = validForm(form);
  if (!fields) return redirect('/form-error.html');

  const name = cleanHeader(fields.name);
  const email = cleanHeader(fields.email);
  const subject = `Website enquiry — ${name}`;
  const text = [
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    '',
    fields.message,
  ].join('\n');

  try {
    await env.EMAIL.send({
      to: DESTINATION,
      from: SENDER,
      replyTo: email,
      subject,
      text,
    });
  } catch (_) {
    return redirect('/form-error.html');
  }
  return redirect('/thank-you.html');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contact') return contact(request, env);
    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', {
        status: 404,
        headers: SECURITY_HEADERS,
      });
    }
    return env.ASSETS.fetch(request);
  },
};
