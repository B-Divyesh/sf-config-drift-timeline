# Find the first configuration difference — verification 4

**Verdict: FAIL**

**Finding count:** 5

**Untested claim count:** 2

**Implementation candidate:** `643d50a60b09568670969fc2afeb72fb5ab315f8`
(`fix: make offline claim and static routes testable`)

**Documentation reviewed:** `9f18df2b3f601d3b9fde18d4509387685e9f8cea`
and `a8a74e01cc9a49cef4290237dd8bd1819f6cc669`

**Live URL:** <https://config-drift-timeline.sociobot.in/>

**Verified:** 2026-09-05 UTC from a clean checkout at `a8a74e0`.

The implementation and documentation SHAs differ because the two later
commits change only `.factory/handoff.md`. Fresh production bytes match a
local build of the implementation candidate.

## Before scrolling

Fresh 1280×800 desktop and 390×844 phone contexts showed the same information
without scrolling:

- **Job:** find the first bad staging and production configuration difference.
- **Audience:** platform engineers explaining when staging and production
  first differed.
- **First action:** **Try it with sample data**.

The action opened the distinct `/demo/` route in one click.

## Findings

### P2 — The demo label is not persistent while the sample is used

The demo starts with **Demo — sample data, nothing is saved**, but the banner
uses `position: static`. After **View the first capture** moves the desktop or
phone viewport to `#sample`, the banner is outside the viewport:

| Viewport | Scroll position | Banner top / bottom | Visible |
| --- | ---: | ---: | --- |
| 1280×800 | 924 px | -924 / -863 px | No |
| 390×844 | 880 px | -880 / -786 px | No |

The sample output and controls therefore look like an ordinary product screen
without the required persistent sandbox label. Make the banner sticky or keep
an equivalent demo label visible beside the sample controls.

### P2 — “Run the same sample in the CLI” is false and has no claim test

The browser demo tells the visitor to **Run the same sample in the CLI**. The
two samples do not describe the same data:

- the browser has four captures and a resolved event; `driftline demo` creates
  two snapshots and reports zero resolved events;
- the browser says `PAYMENTS_WEBHOOK_SECRET` is absent in production; the CLI
  report says it is explicitly null;
- the browser baseline says 18 normalized keys align; the packaged CLI sample
  has eight staging keys and seven production keys.

No entry in `.factory/claims.json` compares these outputs. This is one
unlisted, untested public claim. Use one shared fixture/output or change the
copy so it does not say the samples are the same.

### P2 — The declared exit-code claim test is incomplete

The README says exit codes are `0` for success or no unsafe drift, `1` for
unsafe active drift with `--fail-on-drift`, and `2` for invalid input or usage.
The only tagged test for `free-cli-json` asserts JSON output and exit `1`. It
does not assert the public meanings of exit `0` or exit `2`.

Independent installed-package checks confirmed that the implementation
currently returns all three codes correctly. The finding is the incomplete
declared claim command, not a runtime failure. Extend that one tagged test to
cover the full published exit-code contract. This accounts for the second
untested public claim.

### P3 — Interactive targets are smaller than 44×44 px

Fresh desktop and phone measurements found repeated undersized targets. The
demo banner controls are 42.8 px high. Header wordmarks are 30 px high, footer
wordmarks are 20 px high, and short navigation links such as **Demo**, **Home**,
and **Terms** are narrower than 44 px. Inline legal and contact links are also
14–19 px high.

This misses the attached accessibility, design, and site-structure requirement
that touch targets be at least 44×44 CSS px. Increase the effective hit areas;
the visible text can remain the same size.

### P3 — The required 180 px Apple touch icon is missing

Every page links the SVG favicon, but no page declares an
`apple-touch-icon`, and no 180 px touch-icon asset ships. Live requests to
`/apple-touch-icon.png` and `/apple-touch-icon-180x180.png` return the designed
HTTP 404. Add the required original 180×180 icon and link it on every route.

## Declared claims

`.factory/claims.json` contains 15 unique IDs, and each ID occurs once as a
tagged test. I ran every declared `test` command separately from the clean
checkout. All 15 commands passed:

`raw-values-redacted`, `dotenv-yaml-json`, `cli-no-telemetry`,
`local-only-snapshots`, `null-absent-overridden`, `first-introduction`,
`demo-isolated`, `offline-reload`, `free-cli-json`, `pro-one-time-price`,
`offline-cached-license`, `license-token-only`,
`browser-only-license-storage`, `refund-revocation`, and `first-party-site`.

Passing commands do not remove the two claim findings above. One public claim
is absent from the manifest, and one tagged command covers only part of its
published promise.

## CLI and recovery checks

I packaged the crate, unpacked it into a new `/tmp` consumer directory,
installed it into a new Cargo root, and exercised the installed binary.

- `driftline 0.1.0`, top-level help, `capture --help`, and `report --help`
  worked without prompts.
- `driftline demo` created a new temporary workspace with YAML, dotenv, and
  JSON files, a redacted ledger, and `drift-report.json`. It printed the report
  location and attributed active drift to `priya` in production.
- The installed JSON report had three active unsafe differences. Raw seeded
  tokens were absent from the ledger and report, and input hashes did not
  change.
- Active unsafe drift returned exit `1`. Invalid time, missing ledger,
  duplicate comparison environments, a three-environment comparison,
  unsupported input extension, and a missing required source returned exit
  `2` with useful errors. A valid report after those failures returned exit
  `0`.
- `cargo tree -e normal` contains no HTTP client.

## Live browser, routes, privacy, and offline behavior

- The sample showed aligned, introduced, absent, overridden, and resolved
  output. Selection survived reload. **Reset demo** returned to capture 1 and
  removed only `demo:config-drift-timeline:step`. **Start for real** removed
  that key and returned home. A separate real-data sentinel remained unchanged.
- `/`, `/demo/`, `/privacy/`, and `/terms/` return 200 with route-specific
  titles, one `h1`, one `main`, English language metadata, canonical links,
  descriptions, and social metadata. The social image is 1200×630.
- An invalid path returns the product-styled page with HTTP 404, the title
  **Page not found — Config Drift Timeline**, and working routes home and to
  the sample. This expected 404 is not a defect.
- Playwright AxeBuilder found zero serious or critical issues on all public
  routes and the invalid route. Root and demo had no unexpected console or
  page errors. The first Tab reached the visible skip link with a 3 px blue
  outline; after activation, the next Tab reached the first main action.
- At 200% root font size, all public routes kept their headings and had no
  page-level horizontal overflow or clipped hidden content. Reduced-motion
  mode changed transitions to `0.01ms` and smooth scrolling to `auto`.
- Normal root and demo loads made only same-origin requests. A live invalid
  license check sent one GET query containing only the sample token, stripped
  it from the page URL, set no cookie, returned `Cache-Control: no-store`, and
  left the Pro pack locked. Checkout remains disabled with a clear message.
- After service-worker readiness and `registration.update()`, the phone demo
  reloaded and remained interactive offline. Returning online preserved the
  selected demo capture.
- All internal route, robots, sitemap, and public source links returned 200.
  HTTP redirects to HTTPS. CSP, HSTS, `nosniff`, referrer, permissions, and
  `frame-ancestors` headers are live.

## Build, deployment identity, and performance

These commands passed after `npm ci`:

```sh
npm audit --audit-level=high
npm run typecheck
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
npm test
npm run build
cargo package
```

`npm test` passed five Rust unit tests, two CLI integration tests, six site
contract tests, the packaged consumer test, all 15 claims, and the browser
suite. The browser suite covers desktop, phone, keyboard, service-worker
update, offline reload, console, overflow, and axe checks.

SHA-256 checks matched fresh local build bytes to production for the home,
demo, privacy, terms, and 404 documents; the service worker; both images;
favicon; robots; sitemap; and every generated asset. The live product is the
implementation candidate, not a later report-only commit.

Initial uncompressed assets are 6,428 B JavaScript, 14,512 B CSS, 0 B fonts,
and a 206,912 B hero. Hashed JS and CSS return one-year immutable caching.
A fresh throttled-phone trace measured LCP 628 ms and CLS 0; the hero transferred
207,212 B. Lighthouse produced 99 performance, 100 accessibility, 100 best
practices, and 100 SEO with LCP 1.82 s, TBT 85 ms, and CLS 0, but its tab then
crashed while collecting the full-page screenshot. The crash is a verifier
tool limitation; the completed metrics and direct checks show no performance
finding.

## Earlier findings

| Earlier report | Finding | Current disposition |
| --- | --- | --- |
| `verification.md` | Hashed assets had 30-second caching | Resolved. Live hashed JS and CSS are immutable for one year. |
| `verification.md` | E2E could inspect an occupied port | Resolved. The suite reserves a port and uses `--strictPort`. |
| `verification-2.md` | Paid checkout led to a factory 404 | Safely contained. The live purchase button is disabled; registration remains an external dependency. |
| `review-1.md` | CLI and browser demo were missing | Partly resolved. Both entry points, isolation, reset, and realistic output exist; finding 1 shows the label is not persistent and finding 2 shows their data differ. |
| `review-1.md` | Claims manifest and tagged tests were missing | Partly resolved. Fifteen commands pass; findings 2 and 3 leave two public claims untested. |
| `review-1.md` | Unknown routes returned home with 200 and metadata was incomplete | Resolved. Invalid URLs return the designed HTTP 404 and required route metadata is present apart from finding 5. |
| `verification-3.md` | No defects found under its tested scope | Superseded by the attached demo, claims, touch-target, and touch-icon checks above. |

This is a CLI and static site. Backend tenant isolation, restart persistence,
health, and 429/`Retry-After` checks do not apply. No product code was changed
during verification.

## Required next check

Repair all five findings, extend the claim manifest test coverage, deploy the
new implementation, and repeat the live demo, phone targets, metadata, and all
declared claim commands. After factory billing registration, separately test a
real checkout, return, verification, and download flow.
