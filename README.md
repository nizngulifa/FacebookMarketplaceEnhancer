# FacebookMarketplaceEnhancer

Local Postgres + Cursor MCP setup, plus a Chrome extension under `extension/`.

## Chrome extension

The Manifest V3 extension is a separate subproject. Build instructions, folder layout, and dev workflow:

**[extension/README.md](extension/README.md)**

## Start local database

```bash
docker compose up -d
```

The initial schema for MVP (`chats`, `messages`) is auto-applied from:

`db/init/001_init_chats_messages.sql`

Long-term migration files live in:

`db/migrations/`

## Verify Postgres is healthy

```bash
docker compose ps
```

If you already booted Postgres before the init SQL existed, reset once so init scripts run:

```bash
docker compose down -v
docker compose up -d
```

## Seed sample data

Run this once to create 1 chat and 2 messages:

```bash
docker exec -i fme-postgres psql -U postgres -d facebook_marketplace_enhancer < db/seed/001_seed_chats_messages.sql
```

## Run migration manually (optional)

If you want to apply migration files directly:

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

## Git commit smoke test

A simple docs-only commit can be used to validate local git commit flow.

## Migrate to hosted later

When you're ready for hosted Postgres (Neon/RDS/Supabase), only replace the connection string in:

- `.cursor/mcp.json`
- your app/runtime env var (`DATABASE_URL`)

