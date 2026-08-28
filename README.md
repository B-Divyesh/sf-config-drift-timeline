# Config Drift Timeline

`driftline` is a local-first CLI for answering the awkward incident question:
**when did staging and production first diverge, and who introduced it?** It
captures layered dotenv, YAML, and JSON snapshots without retaining raw values,
then turns them into a semantic, time-ordered drift report.

It is for platform and release engineers comparing application configuration
across environments. It is not a secret manager, deployment system, or remote
poller. Snapshot files are read-only inputs and nothing leaves the machine.

## Install

Build the single binary with a current stable Rust toolchain:

```sh
cargo install --path .
driftline --help
```

The release-ready package can be checked with `cargo package`.

## Usage

Capture the same release in each environment. Later `--source` arguments
override earlier ones; that provenance is retained without storing values.

```sh
driftline capture \
  --env staging \
  --at 2026-08-28T09:00:00Z \
  --actor deploy-bot \
  --source config/base.yaml \
  --source config/staging.env \
  --ledger .drift/timeline.json

driftline capture \
  --env production \
  --at 2026-08-28T09:04:00Z \
  --actor ana@example.com \
  --source config/base.yaml \
  --source config/production.json \
  --ledger .drift/timeline.json

driftline report \
  --ledger .drift/timeline.json \
  --compare staging,production \
  --allowlist drift-allow.yaml
```

Machine-readable output is a stable public surface:

```sh
driftline report --ledger .drift/timeline.json \
  --compare staging,production --format json > drift-report.json
```

Example allowlist:

```yaml
allow:
  - key: LOG_LEVEL
    environments: [staging, production]
    reason: staging is intentionally verbose
  - key: FEATURE_*
    environments: [staging, production]
    reason: preview flags may lead production
```

Run `driftline capture --help` and `driftline report --help` for every option.
Exit codes are `0` for success/no unsafe drift, `1` when `--fail-on-drift`
finds unsafe active drift, and `2` for invalid input or usage.

## Privacy and safety

Raw values are never written to the ledger or report. Every present value is
represented by a one-way SHA-256 fingerprint and its semantic type. Keys that
look secret (`TOKEN`, `PASSWORD`, `SECRET`, `API_KEY`, and similar) are marked
`secret`; null, absent, and values overridden by later layers remain distinct.
Use a ledger path outside source control if even key names are sensitive.

## Site

The static landing/docs site includes a browser-only recorded demo and the
one-time Pro incident-pack license flow. It sends configuration data nowhere.
Checkout is deliberately disabled in ordinary builds until the factory has
registered the matching Sociobot product; this prevents a buyer being sent to
a broken checkout. After registration, the release worker enables it with
`VITE_PRO_CHECKOUT_ENABLED=true` when building the site. Existing licenses can
always be restored and verified.

```sh
npm install
npm run dev
npm run build:site   # writes dist/site
```

## Test and build

```sh
npm test             # Rust tests + site tests
npm run build        # release binary + dist/site
cargo package
```

## Deploy

Deploy `dist/site/` as the static site root. The factory owns registry
publication and deployment; do not publish from a workstation.

## License

MIT. See [LICENSE](LICENSE). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).
