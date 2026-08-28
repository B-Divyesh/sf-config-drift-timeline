# Independent verification 2 — FAIL

**Tested candidate:** `115ad0e0e66f17cdd68d363fb052ea389b6f5386`

**Live URL:** https://config-drift-timeline.sociobot.in/

**Verified:** 2026-08-28 UTC from a clean checkout. `HEAD`, local `main`,
`origin/main`, and `git ls-remote origin refs/heads/main` all matched the tested
candidate before verification. No product code was changed.

## Verdict

**FAIL.** The core CLI, candidate build, live site, previous immutable-cache
repair, accessibility, privacy posture, PWA offline path, and performance
budgets pass. The live product is not releasable because its advertised paid
purchase cannot be started: the production Sociobot checkout endpoint returns
HTTP 404.

## Release-blocking defect

### P2 — the live Pro purchase action ends at a 404

The primary paid action is rendered as **Buy Pro incident pack — $39** and
links to the contractually correct URL:

```text
https://api.sociobot.in/api/v1/products/config-drift-timeline/checkout
```

A fresh request at 2026-08-28 03:54 UTC returned:

```text
HTTP/2 404
content-type: application/json

{"error":"enabled factory product","status":404}
```

Impact: a user can use the free CLI but cannot buy the advertised one-time Pro
pack. This is an external product-registration/release configuration defect,
not a wrong endpoint in candidate code. Register and enable
`config-drift-timeline` in the production Sociobot billing engine, then verify
that the same link redirects to hosted checkout and that a returned real test
license unlocks the download. No direct payment-provider integration belongs
in this repository.

## Repository gates

Environment: Node `22.23.2`, npm `10.9.8`, Rust/Cargo `1.98.0`.

- `npm ci`: passed; 20 packages installed and 0 vulnerabilities reported.
- `npm audit --audit-level=high`: passed with 0 vulnerabilities.
- `npm test`: passed — 5 Rust unit tests, 1 CLI integration test, 5 site
  contract tests, and the Playwright desktop/mobile/keyboard/axe/PWA suite.
- `cargo fmt --all -- --check`: passed.
- `cargo clippy --all-targets --all-features -- -D warnings`: passed.
- Exact `npm run build`: passed and produced the optimized single binary plus
  `dist/site/`.
- `cargo package`: passed verification; 35 files, 361.2 KiB unpacked and
  252.1 KiB compressed.
- Release binary: 1.2 MiB. Package metadata is version `0.1.0`, MIT, with one
  library target and the `driftline` binary.

## Packaged CLI acceptance

The generated package at
`target/package/config-drift-timeline-0.1.0` was installed into an empty
consumer root with `cargo install --path ... --root ...`. The installed binary
reported `driftline 0.1.0`; top-level, `capture`, and `report` help were useful
and non-interactive.

Independent fixtures exercised layered YAML, dotenv, and JSON:

- a staging-only report clearly waited for production rather than fabricating
  a comparison;
- a second production capture identified the first observable unsafe drift at
  `2026-08-28T10:42:00Z`, attributed it to `priya` in `production`, retained
  per-side sources, and marked a JSON override;
- a wildcard allowlist classified `LOG_LEVEL` as allowed while five other
  active differences remained unsafe;
- `--format json --fail-on-drift` emitted valid structured JSON and exited 1;
- an RFC 3339 `-05:00` input normalized to UTC;
- explicit YAML `null` and a missing JSON key appeared separately as `null`
  and `absent`;
- a later matching capture emitted six `resolved` events and left no active
  drift; the same fail-on-drift report then exited 0;
- SHA-256 hashes of every source file were identical before and after capture.

Seeded raw values `raw-yaml-secret`, `raw-dotenv-secret`, and
`raw-json-secret` appeared in neither the ledger nor report. Secret-like keys
were typed `secret`, all present values were fingerprints, and the CLI
dependency tree contains no HTTP client.

Invalid RFC 3339 input, malformed dotenv, a non-object JSON root, an
unsupported extension, duplicate environment/timestamp, duplicate or
three-way `--compare`, malformed allowlist rules, missing ledger, and missing
required `--source` all exited 2 with actionable error/help text. A valid
report still succeeded after these failures.

## Live deployment and browser evidence

### Candidate identity

Fresh live bytes exactly matched the production build for `/`, `/privacy/`,
`/terms/`, JS, CSS, `sw.js`, WebP hero, favicon, robots, and sitemap. Key
SHA-256 pairs included:

- root HTML: `f356127c66f4bd0400f4731f29a06e633c870fb76574e174f5110c4413d4a2f5`
- JS: `a2edae37ae513da2c71a9552bf47af89ab322fe7574ad527cd1ca6d5a5da4118`
- CSS: `ad054980ea6e7bea66296ae401fd139a4802406b64e44aeb9d36f5c6c68a9c57`
- service worker: `1adcdc0ad8d91350ec815a76bc29cda674139eae9bdc4c2e58e3d8ba30badf25`

This establishes that the live static artifact matches candidate
`115ad0e0e66f17cdd68d363fb052ea389b6f5386`.

### Accessibility, interaction, responsive behavior

Independent Playwright 1.58.2 checks ran against production at 1280×800 and
390×844:

- no console errors, uncaught page errors, or horizontal overflow;
- axe reported zero violations of any impact (therefore zero serious/critical)
  on the main, privacy, and terms pages;
- exactly one `h1`, a titled English document, and a `main` landmark;
- first Tab reached the 48.8px skip link; its visible focus outline was 3px
  registry blue, Enter targeted `main`, and subsequent Tab focus continued in
  main content;
- keyboard Enter operated capture buttons and arrow keys operated the range;
  absent, overridden, unsafe, and resolved demo states rendered correctly;
- all visible `button` and `input` controls measured at least 44×44 CSS px;
- reduced-motion emulation changed tested transitions to `0.01ms`, disabled
  smooth scrolling, and removed the active-button transform;
- the 390px composition intentionally stacked content and remained legible.

### Privacy, network, license recovery, and PWA

- A normal production load made only same-origin requests. No remote fonts,
  third-party scripts, analytics, or telemetry were found.
- CSP restricts code and assets to self and permits connections only to self
  and `https://api.sociobot.in`; HSTS, `nosniff`, strict-origin referrer policy,
  permissions policy, and `frame-ancestors 'none'` are present.
- A routed return-license test proved that `?license=` is stripped, the token
  is stored only under `sb_license:config-drift-timeline`, and verification
  sends only that token to the expected Sociobot URL. Invalid-license text and
  keyboard resubmission recovery worked.
- The real verification API returned HTTP 200 with `Cache-Control: no-store`,
  matching-origin CORS, and `{valid:false, reason:"invalid"}` for a fake token.
- After service-worker readiness and `registration.update()`, the page was
  controlled; a fully offline reload rendered the main heading and demo.

### Response and performance policy

- HTTP redirects to HTTPS with 301.
- Root HTML, legal pages, hero, and `sw.js` are revalidatable with 30-second
  freshness. Content-hashed JS and CSS now correctly return
  `public, max-age=31536000, immutable`; a conditional asset request returned
  304 and Brotli was negotiated. The blocker from `.factory/verification.md`
  is fixed.
- Uncompressed initial assets are 7,051 B JS, 12,801 B CSS, 0 B fonts, and
  206,912 B hero WebP, all inside the 200/50/120/300 KiB budgets.
- Lighthouse 12.8.2 mobile: performance 96, accessibility 100, best practices
  100, SEO 100; FCP 1.2 s, LCP 2.1 s, TBT 180 ms, CLS 0. No run warnings.
  Navigation-only lab Lighthouse does not produce an INP value.

## Required next verification

After production billing registration, repeat the checkout request and one
end-to-end test purchase/return/verify/download flow. All other tested release
criteria pass; no product-code change is requested by this report.
