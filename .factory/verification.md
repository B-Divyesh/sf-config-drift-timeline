# Verification 1 — FAIL

**Candidate:** `b27d51a938eb0d2cf70aa0b6f368eb1e3c2664be` (`main` and
`origin/main` matched at verification time)

**Live URL:** https://config-drift-timeline.sociobot.in/

**Verified:** 2026-08-28 UTC, from a clean checkout. This report does not
change product code.

## Verdict

**FAIL** — the CLI and live site work, and the live artifact matches the
candidate build, but the deployed cache policy fails the required static-site
cache contract: immutable, hashed JS and CSS are sent with only a 30-second
freshness lifetime. This is a deployment-only release blocker.

## Release-blocking defect

### P2 — hashed static assets are not cached immutably (deployment)

Fresh `HEAD` requests to the live candidate returned the same header for
`/assets/main-BAxYRirP.js`, `/assets/style-CN4odKTj.css`, the WebP hero, and
`/sw.js`:

```
cache-control: public, must-revalidate, max-age=30
```

The performance acceptance contract requires long-lived immutable caching for
hashed assets. `main-BAxYRirP.js` and `style-CN4odKTj.css` are content-hashed,
so this policy forces avoidable revalidation/network work and does not meet
the contract. The live server demonstrably consumes the deployment config
(its CSP and other global headers are present), so this must be remedied in
the deployment configuration before release. The HTML and service worker may
remain short-lived; hashed assets should receive a long-lived `immutable`
policy.

## Evidence that passed

### Build and repository gates

- Started on clean `b27d51a938eb0d2cf70aa0b6f368eb1e3c2664be`; `git status`
  was clean and `git ls-remote origin refs/heads/main` returned the same SHA.
- `npm ci`: installed cleanly; audit reported 0 vulnerabilities.
- `npm test`: passed: 5 Rust unit tests, 1 CLI integration test, 4 site
  contract tests, and the supplied Playwright desktop/mobile check.
- `cargo clippy --all-targets -- -D warnings`: passed.
- Exact `npm run build`: produced `target/release/driftline` and `dist/site`.
- `cargo package`: passed verification and produced
  `target/package/config-drift-timeline-0.1.0.crate` (248.6 KiB compressed).

### Clean consumer / CLI acceptance flow

Installed the packaged crate, not the checkout, into an empty consumer root:

```
cargo install --path /tmp/driftline-consumer.yZdArN/package/config-drift-timeline-0.1.0 \
  --root /tmp/driftline-consumer.yZdArN/root
```

The installed `driftline` captured YAML, dotenv, and JSON snapshots, emitted
the documented JSON report, named `priya`/`production` as the first observed
unsafe drift actor/environment, marked `LOG_LEVEL` as allowed from a wildcard
allowlist, and returned exit 1 under `--fail-on-drift` with active unsafe
drift. It retained override provenance. Seeded raw secrets did not occur in
the ledger or JSON report.

Boundary and recovery probes passed:

- explicit YAML null versus a missing JSON path appeared as distinct `null`
  and `absent` states;
- a later missing-path staging capture produced a `resolved` event;
- malformed dotenv, invalid RFC 3339 input, duplicate environment/timestamp,
  and duplicate `--compare` environment each exited 2 with actionable error
  and help text.

### Privacy, browser, accessibility, and PWA smoke

- CLI normal dependencies contain no HTTP client. Static inspection found no
  CLI network path or telemetry.
- On a normal live load, browser requests stayed same-origin. The only
  possible runtime cross-origin request is the documented license verification
  endpoint. A routed license test confirmed it sends only the pasted token to
  `https://api.sociobot.in/api/v1/products/config-drift-timeline/verify`,
  strips `?license=` from the URL, stores the scoped local key, and presents
  an invalid-license recovery message.
- Live CSP is restrictive: `default-src 'self'`, local scripts/styles/images,
  and `connect-src` only permits the Sociobot API. HSTS, nosniff,
  `Referrer-Policy`, `Permissions-Policy`, and `frame-ancestors 'none'` were
  present. No remote font or third-party script was loaded.
- Independent Playwright checks against the live URL at 1280px and 390px:
  desktop/mobile have no horizontal overflow, no console/page errors, no axe
  serious or critical findings, a 3px `rgb(21, 91, 120)` visible focus outline,
  and keyboard Enter/Arrow interaction advances the recorded timeline.
  First Tab reaches the visible 48.8px skip link. Reduced motion changes the
  tested toast transition to `1e-05s`.
- After service-worker activation and one controlled online reload, an offline
  reload of the live page rendered the main heading successfully. The service
  worker uses `skipWaiting`, `clients.claim`, and refreshes its declared shell
  entries during install; no update failure was reproduced.
- Asset budgets pass: initial JS 7,051 B, CSS 12,801 B, no font files, and
  the 206,912 B WebP hero are all under the 200 KB / 50 KB / 120 KB / 300 KB
  limits.

### Live identity

Byte hashes matched the fresh `dist/site` output for the deployed root,
privacy and terms pages, JS, CSS, service worker, hero image, favicon,
robots, and sitemap. `/staticwebapp.config.json` returns the intentional SPA
fallback HTML rather than exposing the deployment-control file; it was not
counted as an artifact mismatch. Live behavior and bytes therefore match the
candidate; the failure is the server cache policy.

## Non-blocking defect

### P3 — supplied E2E test can inspect the wrong preview instance

`site/tests/e2e.mjs` launches Vite with a requested port of 4178 but does not
enable strict-port behavior; it nevertheless always navigates to 4178. With
that port occupied, Vite reported `Port 4178 is in use, trying another one…`
and listened on 4179, while the test still inspected the pre-existing 4178
site. This is test isolation/reliability only, not a live-product failure;
the independent live browser checks above did not rely on it.

## Note

An independent Lighthouse CLI run was attempted with the supplied Playwright
Chromium. The CLI browser tab crashed before an audit could be produced,
despite direct Playwright browser QA succeeding. This is a verifier-container
tooling limitation, not a product finding; the explicit bundle, mobile,
accessibility, console, and offline checks above were completed directly.
