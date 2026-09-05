# Find the first configuration difference — verification 4 handoff

## Status: FAIL

**Implementation reviewed:** `643d50a60b09568670969fc2afeb72fb5ab315f8`

**Documentation reviewed:** `9f18df2b3f601d3b9fde18d4509387685e9f8cea`,
`a8a74e01cc9a49cef4290237dd8bd1819f6cc669`

**Live URL:** <https://config-drift-timeline.sociobot.in/>

**Report:** [`.factory/verification-4.md`](verification-4.md)

Independent verification found five defects and two untested public claims.
No product code was changed.

## Findings to repair

1. Keep **Demo — sample data, nothing is saved** visible while the sample
   controls and output are in view.
2. Make the browser and CLI “same sample” data agree, or remove that claim,
   and add its claim test.
3. Extend `@claim:free-cli-json` to assert published exit codes `0`, `1`, and
   `2`.
4. Make every interactive target at least 44×44 CSS px, including the demo
   banner controls, wordmarks, short nav links, and inline contact/legal links.
5. Add and link the required original 180×180 Apple touch icon on every route.

The optional $39 checkout is still safely disabled because factory billing
registration is not present. This remains an external dependency, not a new
product-code finding.

## What passed

- Clean `npm ci`, audit, typecheck, formatting, Clippy, `npm test`,
  `npm run build`, and `cargo package`.
- Every one of the 15 declared claim commands when run separately.
- A clean consumer install of the packaged CLI, including normal, invalid,
  boundary, CI exit-code, redaction, read-only input, and recovery paths.
- Fresh live desktop and phone checks of the first screen and one-click sample.
- Demo storage isolation, reset, leave-demo cleanup, offline reload, and
  service-worker update.
- Live route titles, legal pages, links, privacy requests, security headers,
  styled HTTP 404, and exact local-to-production byte identity.
- Zero serious or critical AxeBuilder findings on home, demo, privacy, terms,
  and 404 pages. Reduced motion and 200% text checks passed.
- Static budgets and direct throttled-phone performance checks passed.

## Run the verification

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

Then run every `test` value in `.factory/claims.json` separately, install the
generated crate into a new Cargo root, and repeat the live checks described in
`.factory/verification-4.md`.

## Evidence

Screenshots, `verify-url.sh` output, and Lighthouse output are under
`/work/.evidence/verification-4/`. The required report copy and machine result
are `/work/.evidence/qa-report.md` and `/work/.evidence/qa-result.json`.

After repairs, deploy a new implementation and rerun verification. After
billing registration, verify one real purchase return and license download.
