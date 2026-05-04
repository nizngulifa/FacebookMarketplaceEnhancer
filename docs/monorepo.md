# Monorepo map

This repository holds **independent** pieces that share a git history and docs. They do **not** import each other’s code today.

| Path | What it is | Typical commands |
|------|------------|------------------|
| `apps/extension/` | Manifest V3 Chrome extension (TypeScript + esbuild) | `make extension-build` or `cd apps/extension && npm run build` |
| `db/` | SQL init, migrations, seeds for local Postgres | Applied via Docker; see [db/README.md](../db/README.md) |
| `docker-compose.yml` | Local Postgres service (`fme-postgres`) | `make db-up`, `make db-seed` |
| `.cursor/mcp.json` | Cursor MCP: Postgres server against `127.0.0.1:5432` | Requires DB running |
| `docs/` | MCP prompts, monorepo map, brain architecture, **extension collaborator guide** | [docs/brain.md](brain.md), [docs/extension-for-collaborators.md](extension-for-collaborators.md) |
| `packages/brain/` | Python: chat → seller next-message (OpenAI), CLI + **local HTTP** for the extension | [README](../packages/brain/README.md), [docs/brain.md](brain.md) |

## New work: where does it go?

- **Extension UI, content scripts, background worker** → `apps/extension/src/` (see [apps/extension/README.md](../apps/extension/README.md); **onboarding + external-integration plan** → [docs/extension-for-collaborators.md](extension-for-collaborators.md)).
- **Schema or seed data** → `db/migrations/` or `db/seed/` (follow [db/README.md](../db/README.md)).
- **LLM / sales “brain” (library, CLI, optional local HTTP)** → `packages/brain/` (`make brain-serve` — secrets via `.env`, never in the extension bundle).
- **Hosted backend later** → add something like `services/api/` or `apps/server/` and document it here; the extension can switch from `127.0.0.1` to that URL in one place (`brain-config.ts`).

## Root shortcuts

From the repo root, `Makefile` targets wrap the common flows (`make help`). npm workspaces live at the root: `npm install` once, then `npm run build:extension`. Python brain: `make brain-install`, `make brain-predict`, **`make brain-serve`** (see [docs/brain.md](brain.md)).
