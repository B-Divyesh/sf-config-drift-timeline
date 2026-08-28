# Handoff — Config Drift Timeline v0.1.0 repair

## Release status: PASS

This repair resolves the independent verifier's only release blocker from
`.factory/verification.md`: Vite's content-hashed JS and CSS were inheriting
the static host's 30-second default cache policy. The repair commits are
`29c7cfd7f664241cd5213f64cdff84fa43b1a676` (cache-policy fix and exact
regression contract) and `aefc16e` (browser test isolation and coverage).
Both are pushed to `origin/main`.

## What changed

- `site/public/staticwebapp.config.json` now has an `/assets/*` route with
  `Cache-Control: public, max-age=31536000, immutable`. This applies only to
  Vite's content-hashed application assets; HTML and `sw.js` intentionally
  retain the host's short revalidation policy.
- The site contract test parses the actual deployment manifest and requires
  the exact route/header pair, while asserting no global cache header can
  accidentally make HTML or the service worker immutable.
- The Playwright preview test reserves a fresh loopback port and enables
  Vite `--strictPort`, fixing the verifier's non-blocking P3 isolation issue.
  It now also exercises keyboard timeline navigation and a service-worker
  controlled offline reload.
- No CLI behavior, collected data, paid feature behavior, visual system, or
  public API changed.

## Deployment and live evidence

Deployed `dist/site` with the factory static deployment helper on 2026-08-28.
Azure Static Web Apps deployment ID: `7165a8ba-ae12-492f-9a26-cd49ff22ff4a`.
The existing production URL is live:
`https://config-drift-timeline.sociobot.in/`.

Fresh production `HEAD` checks returned:

- `/assets/main-BAxYRirP.js`: `Cache-Control: public, max-age=31536000, immutable`
- `/assets/style-CN4odKTj.css`: `Cache-Control: public, max-age=31536000, immutable`
- `/` and `/sw.js`: `Cache-Control: public, must-revalidate, max-age=30`

The root still returns the restrictive CSP, HSTS, `nosniff`,
`Referrer-Policy`, and `Permissions-Policy`. SHA-256 byte identity matched
the fresh `dist/site` output for `/`, `/privacy/`, `/terms/`, both hashed
assets, `/sw.js`, hero WebP, favicon, robots, and sitemap.

## Verification performed

```sh
npm ci
npm audit --audit-level=high
npm test
cargo clippy --all-targets -- -D warnings
npm run build
cargo package
```

- Clean `npm ci` installed 20 packages; audit reported 0 vulnerabilities.
- `npm test` passed: 5 Rust library tests, 1 documented CLI integration test,
  5 site contract tests, and Playwright 1.58.2 browser checks.
- Browser checks passed at desktop 1280px and mobile 390px: no console errors,
  no horizontal overflow, no axe serious/critical violations, click and
  Arrow-key timeline operation, a service-worker update check, and an offline
  shell reload after service worker activation. A separate live-browser run passed at both viewport
  sizes with the same keyboard, console, overflow, and axe checks.
- `cargo clippy --all-targets -- -D warnings` passed. `npm run build` produced
  `target/release/driftline` and `dist/site`.
- `cargo package` verified the ready-to-publish
  `target/package/config-drift-timeline-0.1.0.crate` (360.5 KiB unpacked,
  252.1 KiB compressed). An extracted package was installed into an empty
  consumer root; its `driftline --help`, two captures, and JSON report worked
  and emitted only redacted fingerprints.
- Static privacy inspection found no telemetry or third-party runtime assets.
  The only product API origin is the documented Sociobot license endpoint,
  allowed narrowly by CSP; CLI dependencies have no HTTP client.
- Current production assets are 7,051 B JS, 12,801 B CSS, no font files, and
  a 206,912 B WebP hero, within the 200 KB / 50 KB / 120 KB / 300 KB budgets.

Lighthouse 12.8.2 was attempted with the supplied Playwright Chromium, but
the container's Lighthouse launcher could not connect to that browser. This
is the same environment-tooling limitation recorded by the verifier; direct
Playwright, axe, bundle-budget, response-policy, offline, and live-byte checks
all completed successfully.

## Remaining operational notes

- The factory still needs to register the product with the Sociobot billing
  API before a real checkout or license verification can succeed. No payment
  provider or secret is embedded in the product.
- Publishing remains factory-owned. To produce the verified crate again, run
  `cargo package`; do not publish from this repository.
