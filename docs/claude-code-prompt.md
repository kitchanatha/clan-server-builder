# Claude Code prompt — set up, test, deploy, then build Phase 2

Paste everything below the line into Claude Code, started from the project folder:

```powershell
cd ~\clan-server-builder
git pull
claude
```

Have ready: Discord Client ID, Client Secret, Bot Token (Server Members Intent ON), your test server ID, and `http://localhost:3001/auth/callback` added under OAuth2 → Redirects.

---

You are working on Clan Server Builder in this folder. Read CLAUDE.md and README.md first and follow their rules. I'm on Windows with PowerShell. Work through the stages below in order. Use a task list. At the end of each stage, give me a 3–5 line summary and wait for my "go" before starting the next stage. Never print secrets (tokens, client secret, database passwords) back to me, and never commit `.env`.

## Stage 1 — Prerequisites and environment
1. Check `node -v` (need 20+), `git --version`, and whether `docker` is installed and the engine is running.
2. If Docker works, run `docker compose up -d` and confirm Postgres (5432) and Redis (6379) are up.
   If Docker is missing, stop and ask me to choose:
   - (a) I install Docker Desktop, and you wait and re-check, or
   - (b) cloud: Supabase Postgres (Session pooler URL) + Upstash Redis (`rediss://` URL). If the Supabase connection fails with an SSL or self-signed certificate error, change `createDb()` in `packages/db/src/index.ts` to pass `ssl: { rejectUnauthorized: false }` only when the host is not localhost/127.0.0.1.
3. Make sure `.env` exists (copy `.env.example` if not). Ask me one at a time for DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, DEV_GUILD_ID and write them in. Generate SESSION_SECRET yourself (64 random hex chars). Set the DB/Redis URLs from step 2.

## Stage 2 — Install, check, migrate
1. Run `npm install`, `npm run typecheck`, `npm test`, `npm run db:migrate`.
2. Fix every error you hit. One line per fix explaining what was wrong. Keep fixes minimal, and don't redesign working code.
3. Create branch `local-setup-fixes` for any code changes and commit there.

## Stage 3 — Run and test on my Discord test server
1. Start `npm run dev:api`, `npm run dev:bot`, `npm run dev:web` in the background. Confirm: API listening on :3001, web on :5173, bot logs "logged in as" and "registered 3 dev-guild commands".
2. Give me a short checklist to click through, then wait while I do it:
   - Open http://localhost:5173 → sign in with Discord → my test server appears.
   - Pick a game, keep Welcome/Recruitment/Roster on, edit rules, Save → Add the bot.
   - In Discord: Server Settings → Roles → drag the bot's role ABOVE Leader/Officer/Member/Guest.
   - Dashboard status reaches "Server is ready". Channels and roles match the preview.
   - With a second account: accept rules → `/apply` → fill form. With my account: Approve in #applications → second account gets Member, appears in #roster, gets a DM.
   - `/profile`, `/roster view`, `/roster export` (CSV opens in Excel with Thai text).
   - Change a feature on the dashboard and Save → bot updates the server without duplicating channels.
3. When I report a problem, read the bot/API logs, find the cause, fix it, restart only what's needed, and ask me to retest that step. Add a unit test when the bug is in pure logic.
4. When everything passes, push `local-setup-fixes`, open a PR into main, and tell me the CI result.

## Stage 4 — Deployment files
Add, on branch `deploy`:
1. `Dockerfile` (multi-stage, Node 22 alpine) able to run each app: `api`, `bot`, or a static build of `web`. Prefer one image with a start argument, or three small Dockerfiles. Pick whichever is simpler to host, and say why.
2. Make the API serve the built web app from `apps/web/dist` in production (same origin, so cookies and `/auth` work with no CORS issues), using `@fastify/static` with SPA fallback to index.html for non-/api, non-/auth routes.
3. Run migrations automatically on API start in production.
4. `docs/deploy.md`: step-by-step for Railway (I already use it): services (api+web, bot), Postgres and Redis plugins, required env vars, setting `DISCORD_REDIRECT_URI` and `WEB_ORIGIN` to the production domain, adding the production redirect in the Discord portal, and turning off `DEV_GUILD_ID` so commands register globally.
5. Typecheck, test, build, commit, push, PR.

## Stage 5 — Phase 2: Raid / war sign-ups (premium)
Build on branch `feature/events`, following the "New features" rule in CLAUDE.md.
- Catalog: set `events` to `available: true`. Plan: add `#raid-signups` (guild, read-only for members, staff post) and an `#events-chat` text channel.
- DB: `events` (id, guild_id, type raid|war|other, title, starts_at timestamptz, slots jsonb {tank,healer,dps,flex}, channel_id, message_id, created_by, status open|closed|cancelled, reminded bool) and `event_signups` (event_id, user_id, slot, status going|maybe|out, signed_at). Generate a migration.
- `/event create title start slots…`: staff only. Start time is entered in Asia/Bangkok local time (`2026-11-05 20:00`). Store it in UTC and show it with Discord timestamps `<t:unix:F>` and `<t:unix:R>` so every member sees their own time.
- An embed in #raid-signups with buttons: Tank / Healer / DPS / Flex / Maybe / Can't go. It shows counts against slot limits and names per slot, and updates live. A full slot moves people to a waitlist automatically.
- `/event list`, `/event cancel`, `/event close`.
- Reminder 30 minutes before start: one message pinging everyone signed up as going, sent exactly once even across bot restarts (poll the DB every minute and use the `reminded` flag).
- Dashboard: show the feature as available. No premium payment gating yet, but keep a `isPremiumAllowed(guild)` stub that returns true and is used everywhere premium is checked.
- TH/EN strings for everything. Unit tests for: time parsing in Bangkok time, slot/waitlist logic, plan changes.
- Typecheck, test, commit, push, PR, then give me a test checklist for my test server.

## Stage 6 — Phase 2: Attendance + points (premium)
Branch `feature/attendance`, after Stage 5 is merged.
- When an event is closed, staff get a "Take attendance" button. It shows the sign-up list with toggles (present / absent / late), and adds anyone present who didn't sign up.
- Points per guild config: present +10, late +5, signed up but absent −5 (make these editable on the dashboard).
- `points_ledger` table (guild_id, user_id, delta, reason, event_id, created_by, created_at). Balances are computed from the ledger, never stored.
- `/points me`, `/points top [n]`, `/points adjust user delta reason` (staff), and a points column in the roster export.
- `#attendance-log` channel in the plan, with one summary embed per event.
- Tests, typecheck, commit, push, PR, test checklist.

## Working rules for all stages
- Small commits with clear messages. Keep `main` green.
- If something is ambiguous or would change a decision in CLAUDE.md, ask me instead of guessing.
- If you're blocked by something only I can do (Discord portal, Railway dashboard, payments), say exactly what to click and wait.
