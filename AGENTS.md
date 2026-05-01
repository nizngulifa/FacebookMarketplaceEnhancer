# Agent notes

- **Repo map:** [docs/monorepo.md](docs/monorepo.md)
- **Boundaries:** The Chrome extension under `apps/extension/` must not embed database URLs or secrets; MCP and any future API use root `.env` / server config.
- **Extension builds** output to `apps/extension/dist/`. Static assets (`manifest.json`, `popup.html`, `popup.css`) stay beside `dist/`; load unpacked from `apps/extension/`.
- **SQL changes:** Prefer `db/migrations/` for evolving schema; `db/init/` only for brand-new databases (see [db/README.md](db/README.md)).
- **Commands:** Prefer `make help` and Makefile targets from repo root for DB and extension tasks.