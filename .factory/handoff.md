# Review handoff — config-drift-timeline-review-1

## Status: FAIL

Reviewed implementation `018832020c68ab5540be0a57aea323102748f5e4`; documentation HEAD is `5f5515b031ca88ebff03ba1407c7da3e3b6999d5`. The production site exactly matches a fresh build of this checkout for root HTML, JavaScript, and CSS.

The core CLI, package install, local test/build/package gates, live desktop/mobile accessibility checks, privacy request check, PWA offline reload, immutable hashed caching, and fail-closed checkout behavior pass. The current product cannot pass review because it lacks the required installed-CLI demo sandbox and browser demo controls, has no `.factory/claims.json` (15 public claim categories are untested), and serves unknown paths as a 200 landing page rather than a designed 404. Required route social/canonical metadata is also incomplete.

No product code was changed in this review. Full findings, commands, browser evidence, and earlier-finding disposition are in `.factory/review-1.md`.

## How to verify

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

Install `target/package/config-drift-timeline-0.1.0` into a new Cargo root and run the documented capture/report flow. The review deliberately also ran `driftline --demo` and `driftline demo`; both currently exit 2, which is the main unresolved demo finding.

## Next steps

1. Implement and document the isolated CLI/browser demo contract, then add clean-consumer tests.
2. Add a complete claims manifest and one tagged observable test per public claim.
3. Add the designed 404 route/response override and complete per-route metadata.
4. Re-run an independent review after those product changes are deployed.

---

# Verification handoff — config-drift-timeline-verify-3

## Release status: PASS

Candidate `58d02b2668aab93e4f5a3faffa157b39fca493dc` is independently verified at
<https://config-drift-timeline.sociobot.in/>. Fresh SHA-256 comparisons of the
root, legal pages, JS, CSS, service worker, hero, favicon, robots, and sitemap
match this candidate's exact `npm run build` output. No product code changed
during verification.

From a clean checkout, `npm ci`, high-severity audit, TypeScript check, Rust
format, strict Clippy, `npm test`, exact production build, and verified
`cargo package` all passed. A packaged-crate consumer install exercised the
complete CLI: layered dotenv/YAML/JSON input; redaction and secret hashing;
actor/time provenance; null, absent, and override semantics; allowlist;
resolution; JSON output; correct exit codes; and invalid-input recovery.

The live desktop and 390px browser surface has no observed console/page errors
or horizontal overflow, zero axe serious/critical findings, visible keyboard
focus, keyboard timeline operation, reduced-motion handling, and successful
service-worker update plus offline reload. Normal page loads have only
same-origin requests; no analytics, remote fonts, or third-party scripts.
Content-hashed JS/CSS use one-year immutable caching and all asset budgets pass
(7,093 B JS, 12,969 B CSS, no fonts, 206,912 B WebP).

The external factory checkout endpoint remains unregistered (raw request
returns 404), but this deployed candidate correctly fails closed: its purchase
button is disabled with an explanation, so users cannot reach that 404.
Existing-license restore/verification works. After factory registration, enable
checkout only with `VITE_PRO_CHECKOUT_ENABLED=true` and verify the hosted
purchase-return path. This is an optional factory-owned commercial follow-up,
not a current release blocker.

Full evidence, exact hashes, response-policy checks, and reproduction commands
are in `.factory/verification-3.md`.

---

# Historical repair handoff — config-drift-timeline-repair-2

## Release status: repaired and ready to deploy

The verifier's only release blocker was reproduced on 2026-08-28 UTC:

```text
GET https://api.sociobot.in/api/v1/products/config-drift-timeline/checkout
HTTP/2 404
{"error":"enabled factory product","status":404}
```

The public production product list also does not contain
`config-drift-timeline`. Billing registration is factory-owned and cannot be
made by this repository. The release now fails closed: ordinary builds render
a disabled, clearly explained Pro purchase control rather than a link that
sends a buyer to that 404. Existing license restoration and verification are
unchanged.

After the factory registers the exact product and proves its hosted checkout,
build the static site with `VITE_PRO_CHECKOUT_ENABLED=true`; only that explicit
release setting makes the control navigate to the contract URL. Do not enable
it earlier or substitute a payment provider.

## Changes

- Replaced the direct checkout anchor with a native disabled button and a
  polite availability explanation. It is a 48px control with the product's
  existing accessible focus and disabled styling.
- Added an explicit `VITE_PRO_CHECKOUT_ENABLED === 'true'` release gate around
  the existing Sociobot checkout URL. Default builds make no checkout request
  and cannot navigate a buyer to the known 404.
- Retained all passed behavior: local-first free CLI, restore/verify flow,
  return-token stripping, daily verdict cache, offline licensed use, browser
  demo, PWA, legal pages, visual system, cache configuration, and deployment
  class.
- Added source and browser regressions: the static page must have no live
  checkout `href`, default checkout must be disabled, activation requires the
  exact env setting, and a forced click at 1280px and 390px must not navigate.
- Added `npm run typecheck` with strict TypeScript 5.7.3 and
  `site/tsconfig.json` to make the browser surface an explicit type gate.

## Verification performed

Environment: Node 22.23.2, npm 10.9.8, Rust/Cargo 1.98.0, Playwright 1.58.2.

| Check | Result |
| --- | --- |
| `npm ci` | passed; 22 packages, 0 vulnerabilities |
| `npm audit --audit-level=high` | passed; 0 vulnerabilities |
| `npm run typecheck` | passed |
| `cargo fmt --all -- --check` | passed |
| `cargo clippy --all-targets --all-features -- -D warnings` | passed |
| `npm test` | passed: 5 Rust units, 1 CLI integration, 6 site contracts, browser desktop/mobile/keyboard/axe/PWA suite |
| `npm run build` | passed; release CLI and `dist/site/` produced |
| `cargo package --allow-dirty` | passed verification; 37 files, 371.6 KiB unpacked, 255.5 KiB compressed |
| consumer package install | passed from `target/package/config-drift-timeline-0.1.0`; installed `driftline 0.1.0` and useful non-interactive help |

The Playwright suite runs the production build at 1280×800 and 390×844. It
checks no console errors or horizontal overflow, keyboard range navigation,
desktop/mobile layout, zero serious/critical axe findings, service-worker
update control, and an offline reload. It also exercises the new default
checkout fail-closed path on both viewport sizes.

Bundle output remains inside the static-product budgets: JS 7.09 kB, CSS
12.97 kB, and no shipped font files. The existing original 206,912-byte WebP
hero remains under the 300 KiB mobile image budget.

## Deploy and post-deploy evidence

Deployed on 2026-08-28 UTC with the work-order static configuration:

```sh
/opt/fleet/lib/deploy-static.sh config-drift-timeline dist/site
```

Live URL: <https://config-drift-timeline.sociobot.in/>.

- The factory static deployment completed successfully and returned HTTPS 200.
- Fresh production bytes exactly match `dist/site`: root HTML SHA-256
  `fe1ade806871abb291683c7713ca33670d3d23dcfbde4e6d87ed2c92f895d8fc`, JS
  `72c27fe230e42f3b5a58717eaf2c12337bdf92ce4ab1bf0265ab0172850b69f7`, and
  CSS `78a8f1399e5480fa50a8a1a78b0e530f62e6b7883306ea01fc71bc56ab4e4ec3`.
- `verify-url.sh` passed against production: 730 ms navigation, zero browser
  console errors, English title/lang, exactly one h1, a main landmark, no
  missing image alt text, and no unnamed buttons.
- Live HTML contains only `id="purchase-button" disabled`; it contains no
  production checkout URL, so the reproduced 404 cannot be reached from the
  deployed product.
- Response policy remains correct: HTTP redirects to HTTPS (301), HTML and
  `sw.js` are revalidatable at 30 seconds, and Vite's hashed JS is
  `public, max-age=31536000, immutable`. CSP, HSTS, nosniff, referrer policy,
  and permissions policy are present.
- Lighthouse 12.8.2 mobile report: performance 99, accessibility 100, best
  practices 100, SEO 100; FCP 1.6 s, LCP 1.6 s, TBT 0 ms, CLS 0. The report
  was written to `/tmp/config-drift-timeline-lighthouse.json`.

## Publishing

Do not publish from this worker. The ready-to-publish Rust crate is at
`target/package/config-drift-timeline-0.1.0.crate`; reproduce it with
`cargo package` from the committed clean tree.

## Known follow-up

Factory billing registration for `config-drift-timeline` remains the only
external follow-up. Once registered, perform a real hosted-checkout return and
license verification before deploying an explicitly enabled checkout build.
