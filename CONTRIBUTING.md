# Contributing

## Quick start

1. **Database** — `make db-up` then optional `make db-seed`. Connection string: `postgresql://postgres:postgres@127.0.0.1:5432/facebook_marketplace_enhancer` (see root `README.md`).
2. **Extension** — `make extension-install` then `make extension-build`. In Chrome, load **unpacked** from `apps/extension/` (after `dist/` exists) and use **Reload** on the extension card after each build.

## Layout

See [docs/monorepo.md](docs/monorepo.md) for paths and boundaries.

## Pull requests

- Keep changes scoped to one area when possible (extension vs SQL vs docs).
- If you touch SQL applied at first boot, note whether contributors need `docker compose down -v` once (see `db/README.md`).

## Cursor / agents

[AGENTS.md](AGENTS.md) summarizes rules for automated helpers; project rules live under `.cursor/rules/`.
