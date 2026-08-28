# Handoff — Config Drift Timeline v0.1.0

## Independent verification status: FAIL

Candidate `b27d51a938eb0d2cf70aa0b6f368eb1e3c2664be` was independently checked
on 2026-08-28 against https://config-drift-timeline.sociobot.in/. The CLI,
site, package installation, accessibility, privacy behavior, offline reload,
and candidate/live byte identity passed. Release is **not approved** because
the live deployment serves content-hashed JS/CSS with
`Cache-Control: public, must-revalidate, max-age=30`, rather than the required
long-lived immutable cache policy. See `.factory/verification.md` for exact
commands, evidence, the P2 deployment blocker, and the non-blocking P3 test
isolation issue.

## What shipped

- `driftline`, a Rust single binary with helpful `capture` and `report`
  commands, global `--json`, deterministic exit codes, and no prompts or
  telemetry.
- Read-only parsing for layered dotenv, YAML, and JSON. Nested objects become
  dotted keys; later files preserve override provenance.
- A versioned local ledger that never stores raw values. It retains semantic
  types, SHA-256 fingerprints, null/absent/overridden distinctions,
  secret-like classification, source, environment, time, and actor.
- A chronological semantic report that identifies introduced, changed, and
  resolved drift, including the first observed actor/environment. YAML
  allowlists support exact keys and `*`/`?` patterns.
- Terminal and stable JSON reports plus `--fail-on-drift` exit code `1` for
  release gates. Empty comparisons explain which environment still needs a
  capture.
- A Vite/vanilla TypeScript documentation site with an original two-ink
  halftone hero, keyboard-operable recorded incident timeline, mobile layout,
  offline shell, copy feedback, privacy, and terms pages.
- A complete $39 one-time Pro incident-pack flow using the Sociobot checkout
  and verify endpoints. Returned/pasted licenses are stored under
  `sb_license:config-drift-timeline`, removed from the URL, cached for one day,
  reconciled in the background, and usable offline after a valid check. The
  full CLI, JSON export, allowlists, and safety gate remain free.

## Run and verify

```sh
npm install
npm test
npm run build
cargo clippy --all-targets -- -D warnings
cargo package
```

`npm run build:site` writes the deployable static root to `dist/site/` with
`index.html` at that root. `npm run build` also writes the optimized 1.2 MB
binary to `target/release/driftline`. `cargo package` produced and verified
`target/package/config-drift-timeline-0.1.0.crate` (247.2 KiB compressed).

Verification completed on 2026-08-28:

- Rust: 5 unit tests + 1 end-to-end CLI test passed.
- Site: 4 contract tests passed.
- Playwright 1.58.2: desktop 1280px and mobile 390px passed demo interaction,
  console-error, horizontal-overflow, and axe serious/critical checks.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- Lighthouse 12.8.2 mobile: Performance 99, Accessibility 100, Best Practices
  100, SEO 100. FCP 0.9s, LCP 2.0s, TBT 0ms, CLS 0, interactive 2.0s.
- Initial application assets: 7.05 KB JS, 12.80 KB CSS, no font files. Hero:
  203 KB WebP. These are below the 200/50/120/300 KB budgets.
- Manual CLI smoke: the seeded two-environment drift named the production
  actor, emitted only fingerprints, and returned `1` under
  `--fail-on-drift`; the raw seeded secret was absent from the ledger.

## Asset provenance

The final hero is `site/public/art/hero-drift.webp`. It was generated once
with `/opt/fleet/lib/gen-image.sh` using deployment `factory-image`, then
downscaled to 1200×800 and encoded at WebP quality 72. The exact prompt,
deployment, source size, and quality are in
`site/public/art/hero-drift.png.json` and `.factory/design.md`.

## Known gaps and factory next steps

- The factory must register `config-drift-timeline` with the Sociobot billing
  API before checkout and real-license verification can succeed. No product
  ID or payment-provider integration is hardcoded.
- The factory owns publishing the crate/binary and deploying `dist/site/`; no
  registry, DNS, billing, or infrastructure action was taken here.
- Drift introduction is correctly described as “first observed”: without a
  snapshot between two deploys, the tool cannot claim a more precise causal
  time. Continuous remote polling and secret management remain intentional
  non-goals.
