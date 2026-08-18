# Contact form

The contact form is a native HTML form. There is no browser JavaScript,
third-party form provider, cookie, analytics request or client-side API call.
`public/contact.html` posts `application/x-www-form-urlencoded` data to the
same-origin `POST /api/contact` route in `src/index.js`.

## Architecture

The Worker runs first only for `/api/*`, using the documented
`assets.run_worker_first` route pattern. Requests for real static assets do not
enter the Worker; all non-API requests that do enter it are passed to
`env.ASSETS.fetch(request)`. `not_found_handling = "404-page"` remains under
`[assets]`, so an unmatched asset still receives the configured 404 page.

The endpoint:

1. accepts only `POST /api/contact` with
   `application/x-www-form-urlencoded`;
2. checks the `Origin` and, when present, `Referer` against the request origin;
3. rejects a filled honeypot, missing or whitespace-only fields, malformed email,
   and values over 100 characters for name, 254 for email or 5,000 for message;
4. strips CR/LF from values used in mail headers;
5. sends plain-text mail through the `EMAIL` `send_email` binding to the fixed
   destination `contact@simplerootstherapy.com.au`, from
   `website@simplerootstherapy.com.au`, with the visitor's email as `replyTo`;
6. redirects the browser to `thank-you.html` on success or `form-error.html`
   for validation, origin or send failures.

The binding is restricted with `destination_address`, so a code change cannot
use this binding to send to an arbitrary visitor. The Worker sets the same
security headers as `public/_headers` because Worker-generated responses do not
receive the asset header rules, and adds `Cache-Control: no-store`.

The honeypot reduces automated submissions but is not a complete spam defence.
There is deliberately no Turnstile: it would require browser JavaScript and a
CSP relaxation. The endpoint has no rate limiter or durable abuse store, so the
owner should watch sending limits, bounce reports and mailbox volume. If abuse
becomes material, add a platform-level control or a deliberately reviewed
server-side rate limit without weakening the no-JavaScript policy.

## One-time Cloudflare setup

The owner must do this with Cloudflare access; it has not been performed from
this repository:

1. In the Cloudflare dashboard, open **Compute → Email Service → Email
   Sending**, select **Onboard Domain**, and choose
   `simplerootstherapy.com.au`.
2. Review and accept the DNS records Cloudflare proposes. Email Sending adds
   bounce-processing records below `cf-bounce.simplerootstherapy.com.au`:
   three MX records pointing at Cloudflare's MX servers, the SPF TXT record
   `v=spf1 include:_spf.mx.cloudflare.net ~all`, and the DKIM TXT record at
   `cf-bounce._domainkey.simplerootstherapy.com.au` containing the key shown in
   the dashboard.
3. Review the proposed TXT record at
   `_dmarc.simplerootstherapy.com.au`. Cloudflare's onboarding can add a DMARC
   policy there. This is the important interaction with
   `docs/EMAIL-DELIVERABILITY.md`: that document already tells the owner to
   publish the practice's chosen Microsoft 365 DMARC record. Do **not** publish
   two DMARC TXT records at the same name. If Cloudflare's auto-added record
   conflicts with the documented record, keep one deliberate combined policy
   (including the required reporting addresses) and remove or edit the
   duplicate before verification.
4. Keep the existing Microsoft 365 MX, SPF, DKIM and DMARC setup intact.
   Email Sending uses the separate `cf-bounce` SPF/DKIM records for outbound
   authentication; it must not replace the Microsoft 365 root-domain SPF or
   inbound MX records. SPF still permits only one TXT policy at each name, so
   follow the existing Microsoft 365 guidance when the dashboard presents a
   root-domain change.
5. Wait for DNS propagation, complete the dashboard verification, and create
   or confirm the `website@simplerootstherapy.com.au` sender address on the
   onboarded domain. The Worker binding uses that sender and only the fixed
   contact destination.

Cloudflare documents that DNS changes commonly settle within minutes on
Cloudflare DNS but can take up to 24 hours globally. Do not change DNS or
attempt a real send from this repository.

## Testing

### Local

Install Wrangler if it is not already available, then run the Worker and
assets locally with remote bindings so the Email Service binding is represented:

```text
npx wrangler dev --remote
```

Open the local contact page and submit a harmless test enquiry. The local
request origin is accepted because the Worker compares the submitted
`Origin`/`Referer` with the current request origin; a cross-origin header is
still rejected. Do not use personal health information in a test message.

You can also exercise the rejection paths with `curl` against the local
address: GET `/api/contact`, a JSON POST, missing fields, a filled `website`
field and an `Origin` from another origin should all end at
`/form-error.html`. A successful remote-bound test should end at
`/thank-you.html` and arrive at the fixed contact mailbox.

### Production

After the custom domain and Email Sending onboarding are complete, submit one
short harmless message from `https://simplerootstherapy.com.au/contact.html`.
Confirm the 303 destination, receipt at `contact@simplerootstherapy.com.au`,
the visitor address is in Reply-To, and the message is plain text. Also check
that a direct GET of `/api/contact` fails, a cross-origin POST fails, and real
assets continue to load normally.
