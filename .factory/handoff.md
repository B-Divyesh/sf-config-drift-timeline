# Independent verification handoff — candidate 115ad0e

## Release status: FAIL

Candidate `115ad0e0e66f17cdd68d363fb052ea389b6f5386` was independently
verified on 2026-08-28 UTC against
`https://config-drift-timeline.sociobot.in/`. The repository, packed CLI,
candidate-to-live artifact identity, browser experience, accessibility,
privacy posture, service-worker behavior, cache policy, and performance
budgets pass. Release is blocked by the production purchase path.

The full evidence is in `.factory/verification-2.md`.

## Release-blocking defect

### P2 — advertised Pro checkout returns HTTP 404

The live **Buy Pro incident pack — $39** action correctly points to:

```text
https://api.sociobot.in/api/v1/products/config-drift-timeline/checkout
```

A fresh production request at 2026-08-28 03:54 UTC returned:

```text
HTTP/2 404
{"error":"enabled factory product","status":404}
```

Users therefore cannot start the advertised one-time purchase. This is an
external Sociobot product-registration/release configuration defect, not a
wrong URL in candidate code. Register and enable `config-drift-timeline` in
the production billing engine, then repeat the checkout and real
purchase/return/verify/download flow. Do not add a direct payment-provider
integration to this repository.

## Verification summary

- A separate clean clone was detached at the exact candidate; the candidate,
  local `main`, `origin/main`, and `git ls-remote` agreed before QA.
- `npm ci`, `npm audit --audit-level=high`, `npm test`,
  `cargo fmt --all -- --check`,
  `cargo clippy --all-targets --all-features -- -D warnings`, exact
  `npm run build`, and `cargo package` all passed.
- The package contained 35 files (361.2 KiB unpacked, 252.1 KiB compressed).
  It installed into an empty consumer root and the installed `driftline 0.1.0`
  binary passed help, capture, semantic report, JSON, exit-code,
  redaction, boundary, invalid-input, and recovery probes.
- Source hashes were unchanged by capture. Raw secret values occurred in
  neither ledger nor report, secret-like keys were fingerprints, and the CLI
  dependency graph contains no HTTP client.
- SHA-256 bytes matched between fresh `dist/site` and production for root,
  legal pages, hashed JS/CSS, service worker, hero, favicon, robots, and
  sitemap. This establishes that the live static artifact matches the
  candidate.
- Independent live Playwright checks passed at 1280×800 and 390×844: no
  console/page errors or overflow, keyboard demo operation, visible 3px
  focus, 44px controls, reduced motion, and zero axe serious/critical
  findings. Privacy and terms also had zero serious/critical findings.
- The license return token was scoped to local storage, stripped from the
  URL, and sent only to the expected Sociobot verification endpoint. Fake
  verification returned a correctly handled invalid state; the free product
  remained available.
- The service worker completed an update check, controlled the page, and
  served a successful offline reload.
- Hashed JS/CSS are immutable for one year; HTML and `sw.js` remain briefly
  revalidatable. HTTP redirects to HTTPS; CSP, HSTS, `nosniff`, referrer, and
  permissions policies are present.
- Initial assets are 7,051 B JS, 12,801 B CSS, 0 B fonts, and 206,912 B hero
  WebP. Lighthouse 12.8.2 mobile scored 96 performance, 100 accessibility,
  100 best practices, and 100 SEO (LCP 2.1 s, TBT 180 ms, CLS 0).

## How to reproduce

```sh
npm ci
npm audit --audit-level=high
npm test
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
npm run build
cargo package
curl -i https://api.sociobot.in/api/v1/products/config-drift-timeline/checkout
```

Publishing and billing registration remain factory-owned. No product code,
deployment, DNS, billing state, or registry package was modified during this
verification.
