# Infrastructure

How the site is hosted, what the configuration means, and what to check after
a deploy that cannot be checked before one.

## What it runs on

A **Cloudflare Worker with static assets** — not Cloudflare Pages. The two
have different configuration and different deploy commands, and mixing them up
is the reason the first two builds failed.

`wrangler.toml`:

```toml
name = "ot-site"
compatibility_date = "2026-08-09"
main = "src/index.js"

[assets]
directory = "./public"
not_found_handling = "404-page"
binding = "ASSETS"
run_worker_first = ["/api/*"]

[[send_email]]
name = "EMAIL"
destination_address = "contact@simplerootstherapy.com.au"
```

- **`directory = "./public"`** — everything served lives here. The README,
  `wrangler.toml`, `scripts/`, `docs/`, `tests/` and `assets/` are outside it
  and are never uploaded. The artwork masters in `assets/source-images/` are
  deliberately out of the served tree — see `docs/IMAGES.md`.
- **`not_found_handling = "404-page"`** – an unmatched URL returns **404 with
  `404.html`**, not a 200. That distinction matters: a soft 404 (200 status on
  an error page) makes search engines index the error page.
- **`main = "src/index.js"`** is the no-build Worker entrypoint. The asset
  binding is available as `env.ASSETS`; only `/api/*` is run through the
  Worker first, so normal asset requests bypass it.
- **`send_email`** binds Cloudflare Email Sending as `env.EMAIL` and restricts
  the destination to the practice mailbox. See `docs/CONTACT-FORM.md` for the
  one-time domain onboarding and Microsoft 365 DNS considerations.

There is **no build step**. In Workers Builds the build command stays empty
and the deploy command is `npx wrangler deploy`. `wrangler pages deploy` is
the wrong command here — it takes the Pages path and ignores `[assets]`.

## Routing behaviour worth knowing

**`html_handling` defaults to `auto-trailing-slash`**, which is not set
explicitly in the config. The effect: `/services` serves `/services.html`.
Both URLs resolve.

That is harmless for search because every page carries a `<link rel="canonical">`
pointing at the `.html` form, and the sitemap lists only those, so the two
forms consolidate. It is worth knowing anyway, because it means the site has
more valid URLs than the sitemap lists.

**`_headers` is configuration, not content.** Cloudflare consumes it and does
not serve it. See the caveat below — this is documented behaviour that has
not been confirmed against the live origin from here.

## Keeping the local harness honest

`scripts/lib/server.js` serves `public/` with the real `_headers` so the
checks run against the same policy the deployed site sends. It drifted from
production twice, and both were found by testing rather than review:

| Divergence | Effect | Fixed by |
|---|---|---|
| `_headers` path patterns ignored — every rule applied to every response | HTML reported as cacheable when the edge sends no such header; no path-scoped rule could be tested at all | Matching paths in file order, later rules overriding earlier |
| Extensionless URLs 404'd | `/services` failed locally but works in production | Falling back to `<path>.html`, matching `auto-trailing-slash` |
| `_headers` served as an asset with a 200 | A request that 404s in production returned content locally | Excluding `_headers` and `_redirects` from the served set |

The general point: a test server that *approximates* production quietly
weakens every claim made from it. Where it diverges now, it should be fixed
rather than noted.

## Deploying

Pushes to the branch trigger a Workers Build automatically, and each build
comments a preview URL on the pull request. Two preview forms:

- **Commit preview** — a specific commit, useful for comparing before and
  after
- **Branch preview** — always the branch tip

Merging to the default branch deploys to production.

**Rolling back** is a matter of deploying an earlier commit — either revert
in git and push, or redeploy a previous build from the Cloudflare dashboard.
Since there is no build step and no database, a rollback is complete: there
is no migration to unwind and no cache to warm.

## Custom domain

Not yet attached. The site currently answers on `*.workers.dev` preview URLs.

To put it on `simplerootstherapy.com.au`, add the domain as a **custom domain**
on the Worker in the Cloudflare dashboard. Cloudflare creates the DNS record
and issues the certificate. The apex and `www` should both be attached, with
one redirecting to the other so a single canonical host serves the site — the
canonical tags assume the apex.

**Before attaching the domain, check that the email records survive.** The
practice's mail runs on Microsoft 365, so the MX, SPF, DKIM and DMARC records
must be present in Cloudflare DNS. Moving nameservers to Cloudflare without
carrying those across silently breaks inbound mail — and the site's only
contact route is email, so that failure would be invisible and total. See
`docs/EMAIL-DELIVERABILITY.md`.

## What must be checked after deploy, not before

The build environment's network policy denies requests to the deployed
origin, so the following are confirmed against the local harness and
Cloudflare's documentation but **not** against the live site. Each is one
command:

```bash
SITE=https://simplerootstherapy.com.au

# Security headers actually arrive
curl -sI $SITE/ | grep -iE 'content-security-policy|strict-transport-security'

# A missing URL returns 404, not a soft 404
curl -so /dev/null -w '%{http_code}\n' $SITE/definitely-not-a-page

# _headers is not served
curl -so /dev/null -w '%{http_code}\n' $SITE/_headers        # expect 404

# Extensionless URLs resolve
curl -so /dev/null -w '%{http_code}\n' $SITE/services        # expect 200

# Assets are cached, HTML is not
curl -sI $SITE/styles.css | grep -i cache-control            # expect max-age=86400
curl -sI $SITE/ | grep -i cache-control                      # expect nothing
```

Also worth doing once by hand, and not possible from here: open the site in
Safari and Firefox and confirm the FAQ disclosure, the print output and the
logo all behave. Everything automated has run in Chromium only —
`docs/COMPATIBILITY.md` sets out what that does and does not cover.

## Repository settings still outstanding

- **`main` is not the default branch.** It needs to be set in the repository
  settings; it cannot be changed from a session.
- **HSTS preload** is declared in the header but the domain has not been
  submitted to hstspreload.org. `docs/SECURITY.md` explains why that is a
  deliberate decision rather than an oversight.
