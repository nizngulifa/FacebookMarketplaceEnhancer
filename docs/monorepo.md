# Monorepo map

This repository holds **independent** pieces that share a git history and docs. They do **not** import each other’s code today.

| Path | What it is | Typical commands |
|------|------------|------------------|
| `apps/extension/` | Manifest V3 Chrome extension (TypeScript + esbuild) | `make extension-build` or `cd apps/extension && npm run build` |
| `db/` | SQL init, migrations, seeds for local Postgres | Applied via Docker; see [db/README.md](../db/README.md) |
| `docker-compose.yml` | Local Postgres service (`fme-postgres`) | `make db-up`, `make db-seed` |
| `.cursor/mcp.json` | Cursor MCP: Postgres server against `127.0.0.1:5432` | Requires DB running |
| `docs/` | MCP prompts and this map | — |

## New work: where does it go?

- **Extension UI, content scripts, background worker** → `apps/extension/src/` (see that folder’s README).
- **Schema or seed data** → `db/migrations/` or `db/seed/` (follow [db/README.md](../db/README.md)).
- **Future HTTP API or backend** → add something like `services/api/` or `apps/server/` and document it here; keep secrets in root `.env`, not in the extension.

## Root shortcuts

From the repo root, `Makefile` targets wrap the common flows (`make help`). npm workspaces live at the root: `npm install` once, then `npm run build:extension`.
