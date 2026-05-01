# Canonical tasks for humans and agents. Run from repo root.

.PHONY: help db-up db-down db-ps db-seed extension-install extension-build extension-watch compose-check

help:
	@echo "Targets:"
	@echo "  db-up            Start Postgres (docker compose up -d)"
	@echo "  db-down          Stop Postgres (docker compose down)"
	@echo "  db-ps            Container status"
	@echo "  db-seed          Seed sample chats/messages (requires db-up)"
	@echo "  extension-install  npm install at repo root (workspaces)"
	@echo "  extension-build    Build Chrome extension to apps/extension/dist/"
	@echo "  extension-watch    Rebuild extension on file changes"
	@echo "  compose-check    Validate docker-compose.yml"

db-up:
	docker compose up -d

db-down:
	docker compose down

db-ps:
	docker compose ps

db-seed:
	docker exec -i fme-postgres psql -U postgres -d facebook_marketplace_enhancer < db/seed/001_seed_chats_messages.sql

extension-install:
	npm install

extension-build:
	npm run build:extension

extension-watch:
	npm run watch:extension

compose-check:
	docker compose config
