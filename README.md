# FacebookMarketplaceEnhancer

Local Postgres + Cursor MCP, plus a Manifest V3 Chrome extension. **Repo map:** [docs/monorepo.md](docs/monorepo.md) · **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)

## Chrome extension

The extension lives in **`apps/extension/`**:

**[apps/extension/README.md](apps/extension/README.md)**

From repo root:

```bash
make extension-install   # once: npm install (workspaces)
make extension-build
```

## Start local database

```bash
make db-up
# or: docker compose up -d
```

The initial schema for MVP (`chats`, `messages`) is auto-applied from:

`db/init/001_init_chats_messages.sql`

Long-term migration files live in:

`db/migrations/` — see [db/README.md](db/README.md)

## Verify Postgres is healthy

```bash
make db-ps
# or: docker compose ps
```

If you already booted Postgres before the init SQL existed, reset once so init scripts run:

```bash
docker compose down -v
docker compose up -d
```

## Seed sample data

```bash
make db-seed
```

## Run migration manually (optional)

```bash
docker exec -i fme-postgres psql -U postgres -d facebook_marketplace_enhancer < db/migrations/0001_create_chats_messages.sql
```

## Connection string

Use this URL for local development:

```text
postgresql://postgres:postgres@127.0.0.1:5432/facebook_marketplace_enhancer
```

## Cursor MCP

Project-level MCP config lives at `.cursor/mcp.json` and points to the local database using the official Postgres MCP server package:

`@modelcontextprotocol/server-postgres`

If Cursor does not auto-reload MCPs, reopen the project folder in Cursor.

MCP prompt examples are in:

`docs/mcp-query-prompts.md`

## Agent / IDE helpers

- [AGENTS.md](AGENTS.md)
- `.cursor/rules/`

## Migrate to hosted later

When you're ready for hosted Postgres (Neon/RDS/Supabase), only replace the connection string in:

- `.cursor/mcp.json`
- your app/runtime env var (`DATABASE_URL`)
