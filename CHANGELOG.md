# Changelog

All notable changes follow Keep a Changelog. This project uses semantic
versioning.

## [Unreleased]

### Fixed

- Configure the static host to cache Vite content-hashed `/assets/*` files for
  one year with `immutable`, while keeping HTML and the service worker
  revalidatable.
- Make browser preview tests use a fresh strict loopback port, avoiding an
  accidental inspection of another preview instance.

## [0.1.0] - 2026-08-28

### Added

- Local capture of layered dotenv, YAML, and JSON configuration snapshots.
- Redacted semantic ledger with provenance and secret-key classification.
- Time-ordered terminal and JSON reports with allowlists and CI exit codes.
- Static documentation, browser-only recorded demo, and Pro license flow.
