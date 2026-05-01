# Database

Postgres runs via root `docker-compose.yml`. The database name is `facebook_marketplace_enhancer`.

## Init vs migrations

| Location | When it runs | Use for |
|----------|--------------|---------|
| `db/init/` | **Only** when the data volume is first created (empty `pgdata`) | Baseline schema for a fresh clone; scripts run in lexical order |
| `db/migrations/` | **Manual** (or future migration runner) | Incremental changes after the DB already exists |
| `db/seed/` | **Manual** | Sample or dev data (`make db-seed`) |

### New clone

`docker compose up -d` applies everything in `db/init/` automatically.

### Existing volume without new init files

If you added files under `db/init/` after the DB was already created, init **does not** re-run. Either:

- One-time reset: `docker compose down -v` then `docker compose up -d`, **or**
- Apply the same change via `db/migrations/` and run it manually (see root `README.md`).

### Adding a migration

1. Add a numbered file under `db/migrations/` (e.g. `0002_....sql`).
2. Document the exact `docker exec ... psql ... < db/migrations/....sql` command in the PR or root README if others must apply it.

## MCP

Cursor reads `.cursor/mcp.json`. The Postgres MCP URL must match your local (or hosted) instance when you change environments.
