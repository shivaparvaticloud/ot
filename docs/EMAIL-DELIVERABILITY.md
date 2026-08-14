# Email deliverability — simplerootstherapy.com.au

**Mail provider: Microsoft 365 (Exchange Online).** Every record below is
written for that. If the provider changes, all of it changes.

Nothing here has been applied. These are the exact values to enter, in order,
with a way to verify each one.

Why this matters more than it looks: the growth plan is cold outreach to GPs,
support coordinators and plan managers. Practices of that kind run mail through
filters that are unusually strict, because they are targeted by phishing. A
domain with no authentication and no sending history is the exact profile those
filters drop silently. The recipient never sees the message and you never see a
bounce.

---

## Order of work

Do these in sequence. Each depends on the one before.

- [ ] 1. SPF
- [ ] 2. DKIM
- [ ] 3. DMARC at `p=none`, with reports going somewhere you read
- [ ] 4. Verify all three pass
- [ ] 5. Warm the domain up before any volume
- [ ] 6. Two to four weeks later, move DMARC to `p=quarantine`
- [ ] 7. Four or more weeks after that, move to `p=reject`
- [ ] 8. TLS-RPT (cheap, do it)
- [ ] 9. MTA-STS (optional — see reasoning)
- [ ] 10. BIMI (recommended against — see reasoning)

---

## 1. SPF

One TXT record, at the root of the domain.

| Field | Value |
|---|---|
| Type | `TXT` |
| Name | `@` (the apex, `simplerootstherapy.com.au`) |
| Value | `v=spf1 include:spf.protection.outlook.com -all` |
| TTL | Auto / 1 hour |

### The ten-lookup limit

SPF is evaluated by the receiving server, which must resolve every mechanism
that triggers a DNS query — `include`, `a`, `mx`, `ptr`, `exists`,
`redirect`. **The total is capped at ten.** Exceed it and the result is
`PermError`, which most receivers treat as a failure. Not a warning — a
failure.

`include:spf.protection.outlook.com` costs **one** of the ten. You have nine
in hand, which is comfortable, but it is spent quickly if other systems start
sending as you.

### This is the part practices get wrong

If you later use anything that sends email *as* your domain, it needs its own
`include` **inside the same record**. For a practice that realistically means:

- Practice management software sending appointment reminders (Cliniko, Halaxy,
  Power Diary, Coreplus)
- Accounting sending invoices (Xero, MYOB)
- Any newsletter or form tool

Add them like this — one record, several includes:

```
v=spf1 include:spf.protection.outlook.com include:<provider> -all
```

**Never publish two SPF records.** Two TXT records both starting `v=spf1` is
a `PermError` — the receiver does not pick one or merge them, it fails the
check outright. This is the single most common cause of a domain that
"suddenly stopped being delivered" after adding a new tool.

### `-all` versus `~all`

- `-all` (hard fail) — anything not listed is unauthorised. This is what
  Microsoft documents for M365 and what you should end on.
- `~all` (soft fail) — treat as suspicious but accept.

Publish `-all` from the start **only if** you are confident M365 is the sole
sender. If you are not sure what else might be sending, publish `~all`, let
DMARC aggregate reports (step 3) show you every source for two weeks, then
tighten to `-all`. The reports will tell you what you forgot.

---

## 2. DKIM

M365 does not sign with your domain until you enable it. Out of the box it
signs as `<tenant>.onmicrosoft.com`, which does not align with your From
address, which means **DMARC will fail on DKIM even though DKIM "works"**.

### Find your tenant name

Microsoft 365 admin centre → **Settings** → **Domains**. The one ending
`.onmicrosoft.com` is your initial domain — for example
`simplerootstherapy.onmicrosoft.com`. Call it `<TENANT>` below.

### Publish two CNAMEs

M365 rotates between two selectors, so both must exist. Note the domain name
appears with **dots replaced by dashes** in the target.

| Type | Name | Value |
|---|---|---|
| `CNAME` | `selector1._domainkey` | `selector1-simplerootstherapy-com-au._domainkey.<TENANT>.onmicrosoft.com` |
| `CNAME` | `selector2._domainkey` | `selector2-simplerootstherapy-com-au._domainkey.<TENANT>.onmicrosoft.com` |

If Cloudflare is your DNS, set both to **DNS only** (grey cloud). A proxied
CNAME will not resolve as Microsoft expects.

### Then enable signing

Microsoft Defender portal (`security.microsoft.com`) → **Policies & rules** →
**Threat policies** → **Email authentication settings** → **DKIM** → select
`simplerootstherapy.com.au` → **Enable**.

It will refuse to enable until both CNAMEs resolve. If it errors, the DNS has
not propagated — wait and retry rather than changing anything.

Or by PowerShell:

```powershell
New-DkimSigningConfig -DomainName simplerootstherapy.com.au -Enabled $true
Get-DkimSigningConfig -Identity simplerootstherapy.com.au | Format-List
```

### Confirm it is actually signing

Send to a Gmail address, open the message, **⋮ → Show original**. You want:

```
DKIM: 'PASS' with domain simplerootstherapy.com.au
```

If the domain shown is `<TENANT>.onmicrosoft.com`, signing is on but not
aligned — the CNAMEs are wrong or DKIM was not enabled for the custom domain.

---

## 3. DMARC

DMARC tells receivers what to do when SPF and DKIM disagree with the From
address, and — the part that matters most early — **sends you reports on who
is sending as your domain**.

### Stage 1 — monitor only. Publish this now.

| Field | Value |
|---|---|
| Type | `TXT` |
| Name | `_dmarc` |
| Value | `v=DMARC1; p=none; rua=mailto:dmarc@simplerootstherapy.com.au; fo=1; adkim=r; aspf=r` |

- `p=none` — change nothing about delivery, just report. Safe to publish
  immediately.
- `rua=` — where aggregate reports go. **This address must exist and be
  read.** Create it first.
- `fo=1` — send a failure report if either SPF or DKIM fails.
- `adkim=r` / `aspf=r` — relaxed alignment; subdomains count. Start relaxed.

### Reports are XML, and unreadable by hand

You will receive daily XML attachments from every large receiver. Do not try
to read them raw. Free options that turn them into something legible:

- **Postmark DMARC digests** — free, weekly plain-English email
- **dmarcian** — free tier for a single domain
- **Valimail Monitor** — free

Point `rua=` at their address instead of your own if you use one.

### Stage 2 — quarantine, after two to four weeks

Only when the reports show **100% of your legitimate mail passing**. If
anything legitimate is still failing, fix that first — moving on will send
your own invoices to spam.

```
v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@simplerootstherapy.com.au; fo=1
```

`pct=25` applies the policy to a quarter of failing mail. Raise to `50`, then
`100`, a week apart, watching reports at each step.

### Stage 3 — reject, four or more weeks after that

```
v=DMARC1; p=reject; rua=mailto:dmarc@simplerootstherapy.com.au; fo=1
```

**Criteria for moving to reject:** at least four consecutive weeks at
`p=quarantine; pct=100`, zero legitimate sources failing in aggregate reports,
and no new sending tools added in that window. If you add a tool, go back to
`quarantine` until its reports come back clean.

Reject is the goal. It is what stops someone spoofing your practice to a
client's family — which, for a health service holding children's records, is
the threat that actually matters.

---

## 4. Verification procedure

Run all of these after each stage.

| Tool | Checks | A pass looks like |
|---|---|---|
| `mxtoolbox.com/spf.aspx` | SPF syntax, lookup count | "SPF Record Published", lookups under 10 |
| `mxtoolbox.com/dkim.aspx` (selector `selector1`) | DKIM published | Key found, valid |
| `mxtoolbox.com/dmarc.aspx` | DMARC syntax | Policy shown, no syntax errors |
| `learndmarc.com` | Live walkthrough — send it a message | All three green, alignment shown |
| `mail-tester.com` | Overall spam score — send it a real message | 9/10 or 10/10 |
| Gmail → Show original | Real-world result | `SPF: PASS`, `DKIM: PASS` with **your** domain, `DMARC: PASS` |

Command line, if you prefer:

```bash
dig +short TXT simplerootstherapy.com.au
dig +short TXT _dmarc.simplerootstherapy.com.au
dig +short CNAME selector1._domainkey.simplerootstherapy.com.au
```

The critical one is **Gmail's Show original**. Tools check syntax; Gmail
tells you what a real receiver concluded. DKIM must show *your* domain, not
the `.onmicrosoft.com` one.

---

## 5. MTA-STS and TLS-RPT

These protect mail **in transit to you** against a downgrade attack, where an
attacker strips the TLS negotiation and reads mail in plaintext.

**TLS-RPT — do it.** One record, no infrastructure, and it tells you if
anyone's delivery to you is failing TLS.

| Type | Name | Value |
|---|---|---|
| `TXT` | `_smtp._tls` | `v=TLSRPTv1; rua=mailto:dmarc@simplerootstherapy.com.au` |

**MTA-STS — optional, and here is the honest trade-off.** It requires
hosting a policy file over HTTPS on a subdomain, which means:

1. A TXT record at `_mta-sts` with a version ID you must change on every
   policy edit
2. A file served at
   `https://mta-sts.simplerootstherapy.com.au/.well-known/mta-sts.txt`

You already run static hosting on Cloudflare, so this is more achievable for
you than for most solo practices — but it is a live piece of infrastructure
that breaks mail delivery *to you* if it is misconfigured or the subdomain
lapses. The failure mode is worse than the risk it mitigates at your volume.

**Recommendation: publish TLS-RPT now, defer MTA-STS.** Revisit if you ever
handle clinical correspondence by email at volume — but the privacy policy
already tells clients not to, which is the better control.

---

## 6. BIMI

BIMI displays your logo beside your messages in supporting clients.

**Recommendation: no.** Your expectation is correct.

It requires DMARC at `quarantine` or `reject`, a **registered trademark**, and
a Verified Mark Certificate from DigiCert or Entrust at roughly
**AUD $1,500–2,000 per year**, renewed annually. The trademark alone is months
and its own cost.

For a solo practice sending low volumes to GPs and families, the return is a
small logo in Gmail. That money buys a great deal more as almost anything
else. Revisit only if the practice grows into a multi-therapist brand where
recognition in the inbox has real commercial value.

---

## 7. Cold outreach — beyond DNS

Authentication gets you *eligible* for the inbox. These decide whether you
land in it.

### Legal, first — this is not optional

The **Spam Act 2003 (Cth)** governs commercial electronic messages sent from
or to Australia. Three requirements, all mandatory:

1. **Consent** — express, or *inferred*. Inferred consent can apply where you
   email a work address that has been **conspicuously published** by that
   business, the address is not accompanied by a statement that unsolicited
   messages are not wanted, and **your message is directly relevant to that
   person's professional role**. A GP's published practice address, contacted
   about a referral pathway, generally fits. A personal address, or a scraped
   list, does not.
2. **Identify yourself** — the practice name and contact details, clearly.
3. **A functional unsubscribe** — honoured within five working days. Yes, even
   for B2B, and even in a plain-text personal-looking email.

Penalties are civil and enforced by ACMA. Keep a record of *why* you believed
consent was inferred for each contact.

Separately: **AHPRA's advertising guidelines still apply** to outreach that
promotes a regulated health service, including to referrers. No testimonials,
no outcome claims, no comparative superiority — the same rules the website
follows.

### Warm-up

A domain with no sending history that suddenly sends 200 messages looks
exactly like a compromised account. Ramp:

| Week | Messages per day | Notes |
|---|---|---|
| 1 | 5–10 | To people likely to reply. Replies are the strongest positive signal. |
| 2 | 10–20 | |
| 3 | 20–30 | |
| 4+ | 30–50 | Plateau here. This is a referral network, not a mailing list. |

Send on business days, in business hours, spread across the day rather than
in one burst.

### Format

- **Plain text, or very light HTML.** A message with a header image, buttons
  and a tracking pixel is structurally identical to bulk marketing and gets
  filed accordingly. It also looks less like a colleague writing.
- **No tracking pixels or link shorteners.** Both are strong spam signals, and
  a shortener in a first contact to a medical practice is close to
  disqualifying.
- **No attachments on first contact.** A PDF capability statement in an
  unsolicited email is a common malware pattern. Link to a page instead —
  which is an argument for building the referrer page discussed earlier.
- **One link at most.**

### Phrasing to avoid

Not because words are magic, but because filters weight them and recipients
recognise them: "free consultation", "act now", "limited spots", "guaranteed",
"100%", ALL CAPS, multiple exclamation marks, and — specific to health —
anything that reads as an outcome promise.

Write the way you would to a colleague you respect, because that is who is
reading it.

### One more consideration

Microsoft 365 is built for correspondence, not campaigns. Sustained cold
volume from an M365 tenant can attract throttling regardless of your DNS. At
30–50 personalised messages a day you are well inside normal use. If outreach
ever scales past that, move it to a dedicated sending service on a **separate
subdomain**, so a reputation problem there cannot damage the domain your
client correspondence depends on.

---

## Quick reference — every record

Replace `<TENANT>` with your `.onmicrosoft.com` name.

```
; SPF
simplerootstherapy.com.au.  TXT  "v=spf1 include:spf.protection.outlook.com -all"

; DKIM (grey-cloud / DNS only in Cloudflare)
selector1._domainkey  CNAME  selector1-simplerootstherapy-com-au._domainkey.<TENANT>.onmicrosoft.com
selector2._domainkey  CNAME  selector2-simplerootstherapy-com-au._domainkey.<TENANT>.onmicrosoft.com

; DMARC — stage 1
_dmarc  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@simplerootstherapy.com.au; fo=1; adkim=r; aspf=r"

; DMARC — stage 2
_dmarc  TXT  "v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@simplerootstherapy.com.au; fo=1"

; DMARC — stage 3
_dmarc  TXT  "v=DMARC1; p=reject; rua=mailto:dmarc@simplerootstherapy.com.au; fo=1"

; TLS-RPT
_smtp._tls  TXT  "v=TLSRPTv1; rua=mailto:dmarc@simplerootstherapy.com.au"
```

Microsoft will also require its own `MX`, `autodiscover` and verification
records for the domain — those come from the M365 admin centre when you add
the domain and are not reproduced here, because they are tenant-specific.
