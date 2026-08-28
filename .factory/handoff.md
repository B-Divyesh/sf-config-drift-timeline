# Repair handoff — config-drift-timeline-repair-2

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
