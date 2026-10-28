# Clan Server Builder — project guide for Claude Code

## What this is
A website where an MMO guild leader picks a game (Aion 2 Global, Ragnarok The New World, Any MMO) and features, and one shared Discord bot builds and runs their server. Thai + English everywhere. Owner: Boom (kitchanatha), Bangkok, develops on Windows (PowerShell).

## Layout
- `packages/shared` — feature catalog (`catalog.ts`), `buildPlan()` (`plan.ts`, pure, decides roles/categories/channels/permissions), config schema (`config.ts`), bot strings TH/EN (`i18n.ts`). Dashboard preview and bot both use `buildPlan()`, so they must never diverge.
- `packages/db` — Drizzle schema (`schema.ts`) + SQL migrations in `migrations/`. Tables: guilds, resources, members, applications, sessions.
- `apps/bot` — discord.js v14. `provision.ts` is idempotent: find by `resources` map (logical key → Discord id), then by name, else create. Never delete channels when a feature is turned off. Modules in `src/modules/`.
- `apps/api` — Fastify 5: Discord OAuth (`identify guilds`), `/api/guilds`, `PUT /api/guilds/:id/config`, publishes `csb:config-changed` on Redis.
- `apps/web` — Vite + React dashboard.

## Rules
- Discord bots cannot create servers (removed 2025-07-15). The user creates the server; the bot configures it.
- Bot permissions: fixed set in `BOT_PERMISSIONS` (shared/config.ts). Never request Administrator.
- Every user-facing string needs Thai and English.
- New features: add to `FEATURES` in catalog.ts (`available: true` only when shipped), add channels in `buildPlan()`, add a module in `apps/bot/src/modules/`, wire handlers in `apps/bot/src/index.ts`, add tests in `plan.test.ts`.
- Schema changes: edit `schema.ts`, then `npm run generate -w @csb/db` to create a migration. Never edit an applied migration.
- Before committing: `npm run typecheck` and `npm test` must pass. CI runs typecheck, test, build on push.
- Work on branches, not `main`, unless told otherwise. Never commit `.env`.

## Commands
| Command | Does |
| --- | --- |
| `docker compose up -d` | Postgres + Redis |
| `npm install` | Install all workspaces |
| `npm run db:migrate` | Apply migrations |
| `npm run dev:api` / `dev:bot` / `dev:web` | Run locally (API :3001, web :5173) |
| `npm run typecheck` / `npm test` / `npm run build` | Checks |

## Roadmap
- Phase 1 (done in code, needs real-server testing): base layout, welcome + verify, recruitment, roster.
- Phase 2: raid / war sign-ups (premium), attendance + points (premium), payments, bot verification.
- Phase 3: DKP bidding, tickets, MOBA/FPS pack, game API integrations.
