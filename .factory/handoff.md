# Repair 3 handoff — Config Drift Timeline

## Status: deployed and verified

**Implementation SHA:** `643d50a60b09568670969fc2afeb72fb5ab315f8` (`fix: make offline claim and static routes testable`)

**Documentation handoff SHA:** `9f18df2b3f601d3b9fde18d4509387685e9f8cea` (`docs: record repair 3 handoff`)

This repair completes the three review findings from `review-1.md` while
preserving the local-first CLI scope. The product helps platform and release
engineers find when staging and production first differed, and who introduced
the difference. Its first action is **Try it with sample data**.

## What changed

- The shipped `driftline demo` command creates a new temporary workspace,
  copies bundled dotenv/YAML/JSON incident snapshots there, writes a redacted
  ledger and JSON report, and prints the output path. The landing page records
  that exact command and links directly to the sample.
- `/demo/` is an isolated, one-click browser sample. It has the persistent
  **Demo — sample data, nothing is saved** label, **Reset demo**, and **Start
  for real**. Its only sample state is
  `demo:config-drift-timeline:step`; leaving or resetting discards it.
- `.factory/claims.json` declares 15 visitor-reliant claims. Each has exactly
  one tagged, observable sandbox test. The claim suite includes a packaged
  CLI consumer flow and browser flows for demo isolation, offline reload,
  license storage, revocation, and request privacy.
- Every public page now has route-specific title, canonical, Open Graph, and
  Twitter metadata. `404.html` is product-styled, and Static Web Apps returns
  it with HTTP 404 for unknown URLs. The demo route is separately addressable.
- The service worker now waits for dynamic cache writes before returning an
  asset and uses cache `driftline-shell-v3`. This makes the freshly controlled
  sample and cached-license path reliable offline.
- Static-route checks now exercise responses through a small static-host
  harness rather than only asserting configuration text. Redaction checks
  cover both bundled secret sample values.

## Verification

From a clean dependency install:

```sh
npm ci
npm audit --audit-level=high
npm run typecheck
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
npm test
npm run build
cargo package
```

All commands passed. `npm test` covers Rust units and CLI integration, static
routes, a clean packaged-crate consumer install, all 15 claims, and desktop /
mobile Playwright checks including keyboard, axe, service-worker update, and
offline reload. Each individual `test` command in `.factory/claims.json` was
also run successfully from this checkout. The produced crate is ready for the
factory to publish; do not publish it from this worker.

Final built static assets: main JavaScript 6.43 kB, CSS 14.51 kB (both
uncompressed); no fonts ship. The primary WebP hero remains 206,912 bytes.

## Deployment and live checks

Deployed `dist/site/` with the durable product static configuration:

```sh
/opt/fleet/lib/deploy-static.sh config-drift-timeline dist/site
```

The deployment completed successfully and the custom HTTPS URL responds:
<https://config-drift-timeline.sociobot.in/>.

- `verify-url.sh` passed on `/` and `/demo`: English pages, titles, one h1,
  main landmark, image alt text, named controls, and zero console errors.
- Fresh 1280px and 390px contexts opened the live landing page before scroll.
  Both show the job, audience, and **Try it with sample data** action without
  horizontal overflow. The live sample showed `DATABASE.REPLICA_COUNT`, kept
  its demo label, reset to capture 1, and left a real-data sentinel unchanged.
- Live phone testing confirmed the demo reloads after going offline once
  controlled by the service worker. Normal sample requests stayed on the
  product origin.
- Live Playwright axe scans found zero serious/critical findings on `/`,
  `/demo/`, `/privacy/`, `/terms/`, and `/not-a-real-page`.
- `GET /not-a-real-page` returns HTTP 404, titled
  `Page not found — Config Drift Timeline`; `/demo` returns HTTP 200 with the
  demo title. Hashed application assets return
  `Cache-Control: public, max-age=31536000, immutable`.

Evidence is in `/work/.evidence/repair-3-root/`,
`/work/.evidence/repair-3-demo/`, and the `repair-3-live-*.png` screenshots.
The catalog description is copied to
`/work/.evidence/catalog-description.txt` and is:

> Find the first staging and production configuration difference from redacted local snapshots.

The standalone `npx @axe-core/cli` command could not start because its
Selenium Chrome binary is not installed in this container. This is a verifier
tooling limitation; the product's Playwright AxeBuilder scan ran successfully
against every live route above.

## Earlier finding disposition

| Report | Finding | Current disposition |
| --- | --- | --- |
| `verification.md` | Hashed assets had a 30-second cache lifetime | Resolved; live hashed JS is immutable for one year. |
| `verification.md` | E2E could inspect an occupied preview port | Resolved; the suite reserves a loopback port and uses `--strictPort`. |
| `verification-2.md` | Paid checkout linked to an external 404 | Safely contained; checkout stays disabled until factory registration. |
| `review-1.md` | Required CLI/browser demo missing | Resolved with `driftline demo`, `/demo/`, bundled sample data, and clean consumer coverage. |
| `review-1.md` | Claims manifest and tagged claim tests missing | Resolved with 15 declared, runnable outcome tests. |
| `review-1.md` | Unknown URLs returned the home page with 200; route metadata incomplete | Resolved; live unknown URLs return the designed 404 and all public routes carry required metadata. |

## Known dependency

The optional $39 Pro checkout remains deliberately disabled because factory
billing registration is not present for this product. It is not a mock flow
and no buyer is sent to the former factory 404. Existing-license restore and
verification still work. After the factory registers the product, build with
`VITE_PRO_CHECKOUT_ENABLED=true` and verify the hosted checkout return path.

This is a CLI/static-site product: backend tenant isolation, persistence,
health, and 429 checks do not apply.

## Follow-up

No product-code work remains for this repair. The implementation and
documentation SHAs above deliberately differ because the handoff was committed
after the deployed product implementation.
