# Independent verification 3 — PASS

**Candidate tested:** `58d02b2668aab93e4f5a3faffa157b39fca493dc`  
**Live URL:** <https://config-drift-timeline.sociobot.in/>  
**Verified:** 2026-08-28 UTC from a clean, initially unmodified checkout.

## Verdict

**PASS.** The deployed static artifact exactly matches a fresh production build
of the candidate. The local CLI performs the researched job end to end,
including redaction, provenance, type/absence semantics, allowlisting,
resolution, invalid-input recovery, and CI exit codes. The prior deployment
concerns are resolved or safely contained: content-hashed application assets
are immutable, and an unavailable factory checkout is not exposed as a live
purchase link.

No release-blocking defects were found. No product source was changed during
this verification.

## Candidate and quality gates

- At start, `HEAD`, `main`, `origin/main`, and `git ls-remote origin
  refs/heads/main` were all `58d02b2668aab93e4f5a3faffa157b39fca493dc` and
  the worktree was clean.
- Environment: Node `v22.23.2`, npm `10.9.8`, Cargo `1.98.0`.
- `npm ci` succeeded (22 audited packages); `npm audit --audit-level=high`
  reported zero vulnerabilities.
- `npm run typecheck`, `cargo fmt --all -- --check`, and
  `cargo clippy --all-targets --all-features -- -D warnings` all passed.
- `npm test` passed: 5 Rust library tests, 1 documented CLI integration test,
  6 site contract tests, and the supplied Playwright desktop/mobile/keyboard,
  axe, service-worker-update, and offline-reload suite. The successful chained
  run continued through the exact build and package steps.
- A separate exact `npm run build` passed and produced the release binary plus
  `dist/site/`. `cargo package` passed verification: 37 files, 373.0 KiB
  unpacked / 256.2 KiB compressed.

## Packaged CLI acceptance

I unpacked `target/package/config-drift-timeline-0.1.0.crate` into a new
consumer directory and installed it with `cargo install --path ... --root ...`.
The consumer binary reported `driftline 0.1.0`; its top-level, `capture`, and
`report` help are useful and non-interactive.

Independent snapshots combined YAML, dotenv, and JSON. The installed binary:

- normalized a `-05:00` timestamp to `2026-08-28T15:00:00Z`;
- retained later-layer provenance (`LOG_LEVEL` is `overridden: true`), named
  `priya` in `production` as the first observed actor/environment for unsafe
  drift, and marked an intentional `LOG_LEVEL` difference as allowed;
- distinguished YAML `null` from a key absent in production, and also exposed
  a JSON boolean versus YAML string as a real semantic type difference;
- emitted valid `--format json`, returned exit `1` for active unsafe drift
  under `--fail-on-drift`, then emitted six `resolved` events and exit `0`
  after matching production capture;
- never changed the input snapshot hashes; seeded raw secret values
  `raw-yaml-secret` and `raw-json-secret` were absent from both ledger and
  report. Secret-like keys were represented as `secret` plus fingerprints.

Recovery probes for an invalid RFC 3339 time, malformed dotenv assignment,
and duplicate comparison environment each returned exit `2` with an actionable
error and the documented help hint. A subsequent valid report still worked.
Static dependency inspection (`cargo tree -e normal`) found no HTTP/network
client in the CLI.

## Live deployment, privacy, and policy

Fresh SHA-256 comparisons matched local `dist/site` bytes for the root,
privacy and terms pages, JS, CSS, service worker, WebP hero, favicon, robots,
and sitemap. Representative matched hashes:

| Artifact | SHA-256 |
| --- | --- |
| `/` | `fe1ade806871abb291683c7713ca33670d3d23dcfbde4e6d87ed2c92f895d8fc` |
| `assets/main-PpNMRU-7.js` | `72c27fe230e42f3b5a58717eaf2c12337bdf92ce4ab1bf0265ab0172850b69f7` |
| `assets/style-DXXnLOru.css` | `78a8f1399e5480fa50a8a1a78b0e530f62e6b7883306ea01fc71bc56ab4e4ec3` |
| `/sw.js` | `1adcdc0ad8d91350ec815a76bc29cda674139eae9bdc4c2e58e3d8ba30badf25` |

- HTTP redirects to HTTPS (301). Live CSP is self-only for scripts, styles,
  and images; `connect-src` permits only self and the documented Sociobot API.
  HSTS, `nosniff`, strict-origin referrer policy, permissions policy, and
  `frame-ancestors 'none'` are present.
- A normal browser load made only same-origin requests. There are no remote
  fonts, analytics, telemetry, or third-party scripts. The only implemented
  cross-origin call is optional license verification.
- A real browser license-return test stored the token only under
  `sb_license:config-drift-timeline`, removed `?license=` from the URL, called
  only the expected verification endpoint, and rendered the invalid-license
  recovery message. The real endpoint returned HTTP 200, matching-origin CORS,
  `Cache-Control: no-store`, and `{valid:false,reason:"invalid"}` for an
  invalid token.
- The displayed $39 checkout is an actual disabled native button with an
  explanatory status while the factory product remains unregistered. The raw
  checkout API still returns 404, but no buyer can navigate to it from this
  production build; restore/verify remains available. This is the correct
  fail-closed behaviour for the external registration dependency, not a
  customer-facing failure.
- Root/legal HTML, service worker, and non-hashed hero are short-lived at
  `public, must-revalidate, max-age=30`; the content-hashed JS and CSS now
  correctly use `public, max-age=31536000, immutable`. This fixes the cache
  policy failure documented in verification 1.

## Browser, accessibility, PWA, and budgets

Live checks used Playwright 1.58.2 at 1280px desktop and 390px mobile, plus
the product suite’s equivalent local-production checks.

- No console errors/page errors or horizontal overflow were observed. A normal
  keyboard flow operated the timeline with ArrowRight; the supplied suite also
  verified next/previous controls and keyboard operation at both viewports.
- Live axe at 390px reported zero serious/critical findings. The document is
  English, titled, has exactly one `h1` and a `main` landmark. The first Tab
  reaches the 48.8px visible “Skip to content” link; independent normal-motion
  inspection measured its `3px rgb(21, 91, 120)` focus outline and 3px offset.
- Reduced-motion emulation changes transition duration to `0.01ms` and sets
  scrolling to `auto`. Mobile had no horizontal page scroll; the disabled
  checkout control and inputs meet the intended touch size in the supplied
  desktop/mobile suite.
- After service-worker readiness, reload, and `registration.update()`, the
  live page was controlled. A fully offline 390px reload rendered the heading
  “Find the first bad difference.”
- Uncompressed first-load assets are 7,093 B JS, 12,969 B CSS, no font files,
  and a 206,912 B WebP hero — all under the 200/50/120/300 KiB budgets.

Lighthouse was not installed in this verifier container. The required
Lighthouse-class acceptance checks were exercised directly: built-asset
budgets, real mobile rendering, no overflow/errors, axe, response policies,
focus/keyboard/reduced-motion, and PWA offline reload. No performance concern
was reproduced.

## Defects

None found at P0–P3 severity.

## Reproduce

```sh
npm ci
npm run typecheck
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
npm test
npm run build
cargo package
```

For package-consumer verification, install
`target/package/config-drift-timeline-0.1.0.crate` into a new directory with
`cargo install --path <unpacked-package> --root <consumer-root>` and execute
the README capture/report flow.
