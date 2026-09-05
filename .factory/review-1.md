# Explain the first configuration difference — review 1

**Verdict: FAIL**

**Implementation candidate reviewed:** `018832020c68ab5540be0a57aea323102748f5e4` (`fix: fail closed when Pro checkout is unavailable`)

**Documentation HEAD:** `5f5515b031ca88ebff03ba1407c7da3e3b6999d5` (`docs: record verification 3 pass`)

**Live URL:** <https://config-drift-timeline.sociobot.in/>

**Reviewed:** 2026-09-05 UTC, from a clean checkout. Documentation-only commits follow the implementation candidate. Fresh production bytes match a build of this checkout, so the live product is the candidate reviewed.

## Before scrolling

- **Job:** explain when staging and production first became meaningfully different, and who introduced the difference.
- **Audience:** platform and release engineers investigating configuration drift.
- **First action shown on desktop and phone:** **Install driftline**. The adjacent action is **Trace the seeded incident** and only jumps to a fixed page section. There is no visible one-click **Try it with sample data** action.

## Findings

### P1 — The required CLI demo sandbox is missing

The product is a CLI, so its required demo is `driftline --demo` or `driftline demo`, using bundled realistic sample input in a temporary directory, plus a self-hosted terminal recording on the landing page. Neither command exists: both returned exit 2 with an unrecognised argument/subcommand. `examples/` has snapshots, but no executable demo entry point or `.factory/demo.md` describes one.

The browser has a fixed four-step illustration, but it is not the required sandbox: the first screen has no sample-data action; `/demo` and `/?demo=1` return the landing page without entering a demo mode; there is no persistent **“Demo — sample data, nothing is saved”** label, **Reset demo**, or **Start for real** action. It is possible to advance the static timeline and see realistic unsafe, absent, overridden, and resolved states, but it cannot demonstrate the installed artifact doing the job or prove isolation/reset behavior.

**Impact:** a prospective engineer cannot run the real CLI job with sample data in one click, and the catalog/verifier URL cannot enter the promised isolated demo.

**Required repair:** ship a bundled `demo` command (or `--demo`) that writes its work only to a new temporary directory and prints the report/output location; add the required landing action, persistent demo label and reset/leave controls or a self-hosted recording of that exact command; document URL/command, fixtures, reset, and storage namespace in `.factory/demo.md`; test it from a clean consumer install.

### P2 — No claims manifest exists; 15 public claim categories are contractually untested

`.factory/claims.json` is absent. Therefore there are no `@claim:<id>` tests and no claim commands to run, despite the landing page, README, privacy page, and terms making visitor-reliant promises.

I counted 15 distinct public claim categories that need one observable tagged test each: redaction/no raw ledger values; dotenv/YAML/JSON support; no telemetry/no CLI network path; local-only snapshot processing; semantic null/absent/override handling; first-introduction provenance; demo does not read/upload files; site offline after first visit; source/CLI export and CI behaviour remain free; one-time $39 pack; offline cached license use; verification sends only a license token; browser-only license storage; legal refund/revocation behaviour; and no third-party site resources/analytics. Existing general Rust and Playwright tests cover parts of several of these, but none is registered as the exactly-one claim test required by the contract.

**Impact:** the product cannot make a verified public claim under the factory contract. This review records `untested_claim_count: 15`.

**Required repair:** add `.factory/claims.json`, reduce copy to claims that can be tested, and give every remaining claim exactly one clean demo/consumer test tagged `@claim:<id>`. Run every listed command successfully from a clean checkout.

### P2 — Required real 404 and route metadata are absent

`GET /not-a-real-page` on production returns HTTP 200 and the home document, rather than a designed 404 with a route-specific title and a way back. The same fallback makes `/demo` a 200 landing page rather than a distinct demo route. This is not a deliberate HTTP 404 and does not meet the required 404 design or real-URL routing contract.

The root page also lacks the required Open Graph and Twitter card metadata. `/privacy/` and `/terms/` have route-specific titles, but no canonical link, Open Graph metadata, or Twitter metadata. `staticwebapp.config.json` has no 404 response override or 404 asset.

**Impact:** invalid URLs are indistinguishable from the product home and required route/preview metadata is missing.

**Required repair:** add a product-styled `404.html` with an explicit Static Web Apps 404 response override, retain the valid SPA fallback only where appropriate, make `/demo` a real demo route if it is advertised, and add canonical, Open Graph, and Twitter metadata to every route.

## Evidence that passed

### Candidate and local quality gates

- Checkout began clean at documentation HEAD `5f5515b`; code changed most recently in candidate `0188320`.
- `npm ci`, `npm audit --audit-level=high`, `npm run typecheck`, `npm test`, `npm run build`, `cargo fmt --all -- --check`, `cargo clippy --all-targets --all-features -- -D warnings`, and `cargo package --allow-dirty` all passed. The package verification produced a 258.9 KiB crate.
- `npm test` passed 5 Rust library tests, 1 CLI integration test, 6 static-site tests, and the desktop/mobile Playwright, keyboard, axe, service-worker-update, and offline-reload test.
- Built initial assets are 7,093 B JavaScript and 12,969 B CSS; no font files ship; the WebP hero is 206,912 B. These are within the stated budgets.

### Clean consumer CLI flow

- Installed the packaged crate into a new `/tmp` consumer root with `cargo install --path target/package/config-drift-timeline-0.1.0 --root <consumer-root>`. The installed binary reported `driftline 0.1.0`.
- Captured the shipped staging and production YAML fixtures and generated a JSON report. It recorded `priya` in `production` as introducer, two active unsafe differences, and secret-like keys as `secret` fingerprints without raw values.
- Invalid RFC 3339 input and duplicate comparison environments each returned exit 2 with an actionable help hint. A valid report immediately after those failures returned exit 0, demonstrating recovery.
- `cargo tree -e normal` contains no HTTP client dependency. The input fixture files are read-only during capture.

### Fresh live desktop and phone browser checks

- Fresh Playwright contexts at 1280×800 and 390×844 loaded without console errors, page errors, or horizontal overflow. The before-scroll title, heading, copy, and first actions are recorded above.
- The fixed timeline correctly advanced with buttons and ArrowRight from `DATABASE.REPLICA_COUNT` to `PAYMENTS_WEBHOOK_SECRET`; it showed unsafe, absent, overridden, and resolved example states. The disabled checkout did not navigate.
- Axe found zero serious or critical violations on `/`, `/privacy/`, `/terms/`, `/demo`, and the fallback URL. `verify-url.sh` passed: English document, title, one h1, main landmark, image alt text, named buttons, and no console errors. Keyboard skip link, focus styling, and reduced-motion behavior remain covered by the passing product suite.
- A normal browser load requested only `https://config-drift-timeline.sociobot.in`. A service-worker-controlled phone context reloaded the main heading while offline after an online visit.
- All internal, GitHub source, privacy, terms, robots, and sitemap links checked in this review returned 200 (anchors and `mailto:` links were not treated as HTTP pages).

### Earlier findings and their current disposition

| Earlier report | Finding | Current disposition |
| --- | --- | --- |
| `verification.md` | P2: content-hashed assets had a 30-second cache lifetime | **Resolved.** Live JS and CSS both return `Cache-Control: public, max-age=31536000, immutable`. |
| `verification.md` | P3: E2E preview could inspect a different port | **Resolved.** `site/tests/e2e.mjs` reserves a loopback port and starts Vite with `--strictPort`; the suite passed. |
| `verification-2.md` | P2: advertised checkout linked to a factory 404 | **Resolved for users.** The raw factory endpoint still returns 404, but the live purchase control is disabled and did not navigate in desktop or phone testing. |
| `verification-3.md` | No P0–P3 defects found | **Superseded by this audit’s newly checked demo, claims, and route-structure contracts.** Its cache, checkout containment, CLI, accessibility, offline, and privacy observations remain reproducible as recorded above. |

## Scope notes

- This is a CLI/static-site product. Tenant isolation, restart persistence, health endpoints, and 429/`Retry-After` backend checks are not applicable.
- No production data, credentials, or non-product services were accessed. The sample fixtures and a disposable local consumer root were used for CLI verification.
- A raw factory checkout 404 is an expected external state while checkout is fail-closed; it is not counted as a new product defect.

## Reproduce

```sh
npm ci
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo package
```

Then install the unpacked package into a new consumer root and run the README capture/report flow. The missing `driftline demo` / `--demo` commands should currently fail with exit 2; that failure is finding P1.
