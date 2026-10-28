# Claude Code master prompt: Clan Server Builder

How to start, in PowerShell:

```powershell
cd ~\clan-server-builder
git checkout main
git pull
claude
```

Then paste everything below the line. Have these ready:
- Discord application **Client ID**, **Client Secret**, **Bot Token** (Bot tab, with **Server Members Intent** ON)
- `http://localhost:3001/auth/callback` added under OAuth2 → Redirects
- A private **test server** and its Server ID (Developer Mode → right-click server → Copy Server ID)
- A second Discord account (or a friend) to act as a new member

---

You are the lead developer on **Clan Server Builder**, my product. Read `CLAUDE.md` and `README.md` first and follow their rules exactly.

## Product context
- A website where an MMO guild leader (Aion 2 Global, Ragnarok The New World, any guild-based MMO) picks a **template**, turns **features** on and off, customizes everything for their guild, and one shared Discord bot builds and runs their server.
- Every guild is different, so everything is per server: rank names, class list, nickname format, welcome/goodbye text, class roles, alert roles, and later per-feature settings. Nothing one customer does may affect another.
- Business model:
  - Free templates and features
  - Premium features on a monthly plan per server
  - Custom features built for one guild on request and enabled only for that guild
- Thai and English for every user-facing string. I'm in Bangkok (Asia/Bangkok) and work on Windows with PowerShell.

## How to work
- Use a task list. Work through the stages below in order. At the end of each stage, give me a 3–5 line summary and **wait for my "go"** before starting the next.
- Work on a branch per stage, open a PR, wait for CI to go green, and tell me the result. Never push straight to `main` unless I say so.
- `npm run typecheck` and `npm test` must pass before every commit. Add unit tests for any pure logic you write or fix.
- Keep fixes minimal. Don't redesign working code without asking.
- Never print secrets (bot token, client secret, DB passwords) back to me, and never commit `.env`.
- If something only I can do (Discord developer portal, Railway, GitHub settings, payments), tell me exactly what to click and wait.
- If something is ambiguous or would change a decision in `CLAUDE.md`, ask me instead of guessing.

## Stage 0: Merge pending work
1. Check GitHub PR #1 (`feature/member-management`). If CI is green and it merges cleanly, tell me and wait for me to merge it on GitHub (or merge it yourself if I say so). Then `git checkout main && git pull`.
2. Confirm `main` contains `apps/bot/src/modules/roles.ts` and `packages/db/migrations/0001_registrations.sql`.

## Stage 1: Prerequisites and environment
1. Check `node -v` (20+), `git --version`, and whether `docker` is installed with the engine running. Node is already v24 on this machine; Docker was **not** installed last time.
2. If Docker is missing, stop and ask me to choose:
   - (a) I install Docker Desktop (WSL 2), and you wait and re-check, then `docker compose up -d`;
   - (b) cloud: Supabase Postgres (Session pooler URL) + Upstash Redis (`rediss://` URL). If node-postgres fails with an SSL or self-signed certificate error, change `createDb()` in `packages/db/src/index.ts` to pass `ssl: { rejectUnauthorized: false }` only when the host is not localhost/127.0.0.1.
3. Make sure `.env` exists (copy `.env.example`). Ask me **one at a time** for DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN, DEV_GUILD_ID and write them in. Generate SESSION_SECRET yourself (64 random hex chars). Set DATABASE_URL and REDIS_URL from step 2.
4. Note: there is a stale copy of the repo in `~\Downloads\clan-server-builder`. Ignore it.

## Stage 2: Install, check, migrate
1. `npm install`, `npm run typecheck`, `npm test`, `npm run db:migrate`.
2. Fix every error, one line per fix. Commit fixes on `fix/local-setup`.

## Stage 3: Run and test end to end on my test server
1. Start `npm run dev:api`, `npm run dev:bot`, `npm run dev:web` in the background. Confirm: API on :3001, web on :5173, bot logs "logged in as" and registered dev-guild commands (apply, register, rank, profile, roster).
2. Give me this checklist one block at a time, and wait for my result after each:
   - **Dashboard:** open http://localhost:5173 → sign in → my test server appears → pick Aion 2 → template **Recruiting guild** → in "Make it your guild" rename ranks (Guild Master / Elite / Member / Rookie), set nickname format `[{class}] {ign}`, turn on class roles, alert roles "Raid Alerts", "Guild War" → Save → **Add the bot**.
   - **Discord setup:** Server Settings → Roles → drag the bot's role **above** all the ranks, class roles and alert roles. Dashboard status reaches "Server is ready". Channels and roles match the preview (#welcome, #arrivals, #pick-roles, #apply-here, #roster, staff channels, voice).
   - **Member flow (second account):** joins → greeting in #arrivals → only public channels visible → Register → picks class → types IGN → nickname becomes `[Class] IGN`, gets Rookie + class role, chat unlocks → #pick-roles: change class, add/remove alerts → `/register` again updates the name.
   - **Recruitment:** second account `/apply` → I approve in #applications → they get Member, appear in #roster, get a DM.
   - **Ranks:** `/rank set` (Officer can set Member/Rookie, only Leader can set Elite/Guild Master), `/rank remove`, can't change own rank.
   - **Roster:** `/profile`, `/roster view`, `/roster export` (CSV opens in Excel with Thai text).
   - **Goodbye:** second account leaves → goodbye in #arrivals shows their IGN → they're removed from the roster.
   - **Live update:** change a rank name and the welcome text on the dashboard → Save → the bot renames the role and updates panels without duplicating anything. Turn a feature off → nothing gets deleted.
3. When I report a problem, read the logs, find the cause, fix it, restart only what's needed, and ask me to retest that step. Add a test if the bug is in pure logic.
4. When everything passes, push the fix branch, open a PR, report CI.

## Stage 4: Product model (templates, entitlements, custom features, admin)
Branch `feature/product-model`.
1. **Templates as data:** move `TEMPLATES` to JSON-like data (id, names TH/EN, description, features, default ranks, default classes, default member settings) so new templates need no code changes. Picking a template on the dashboard also fills its default settings, but only those the user hasn't edited yet. Add templates "Casual guild" and "Hardcore PvP".
2. **Customers and access:**
   - A `customers` table (Discord user id, name, created_at). The person who first saves a server becomes its owner.
   - A `guild_admins` table so an owner can add co-admins by Discord user id (manage this on the dashboard). Co-admins can edit that server without Manage Server permission.
3. **Entitlements:**
   - A `entitlements` table (guild_id, plan free|premium, plan_expires_at, custom_features text[], notes).
   - One `isPremiumAllowed(guildId)` and one `hasCustomFeature(guildId, id)`, used everywhere in the bot, API and dashboard.
   - Premium features show a lock and an "Upgrade" button when not entitled (no payment yet, the button opens a contact link).
4. **Custom features:**
   - Add `scope: 'public' | 'private'` to features. Private features live in `apps/bot/src/modules/custom/<feature-id>/`, appear on the dashboard only for servers that have them in `custom_features`, and run only there.
   - Ship one example private feature, `custom-boss-timer` (`/boss set name minutes` → reminder in a channel), to prove the pattern.
5. **Admin page `/admin`** (only Discord user ids in `ADMIN_USER_IDS` env var). It lists all servers with:
   - owner, game, features, plan, setup status, last error and member count;
   - actions to set plan + expiry, grant/revoke custom features, and force a re-setup.
6. **Feature requests:** a "Request a custom feature" form on the dashboard that saves to a `feature_requests` table and shows on `/admin`.
7. Tests for entitlement checks and template merging. Typecheck, test, PR, CI, then a checklist for me.

## Stage 5: Deploy (Railway)
Branch `deploy`.
1. Dockerfile(s), multi-stage on Node 22 alpine. One image with a start argument (`api` or `bot`), unless separate ones are clearly simpler. Explain the choice.
2. In production the API serves the built dashboard from `apps/web/dist` (same origin), using `@fastify/static` with SPA fallback for non-`/api`, non-`/auth` routes. Secure cookies when `WEB_ORIGIN` is https.
3. Run migrations automatically on API start in production.
4. `docs/deploy.md`, step by step for Railway:
   - services: api+web, bot; Postgres and Redis plugins; all env vars;
   - set `DISCORD_REDIRECT_URI` and `WEB_ORIGIN` to the production domain, and add that redirect in the Discord portal;
   - remove `DEV_GUILD_ID` so commands register globally; health check `/api/health`.
5. A health/heartbeat log for the bot, and graceful shutdown already exists, so keep it.
6. PR, CI, then walk me through the Railway clicks and wait.

## Stage 6: Raid / war sign-ups (premium)
Branch `feature/events`. Follow the "New features" rule in CLAUDE.md and gate with `isPremiumAllowed`.
- Catalog: `events` → `available: true`. Plan: `#raid-signups` (guild, read-only, staff post) and `#events-chat`.
- DB:
  - `events` (id, guild_id, type raid|war|other, title, starts_at timestamptz, slots jsonb, channel_id, message_id, created_by, status open|closed|cancelled, reminded bool);
  - `event_signups` (event_id, user_id, slot, status going|maybe|out|waitlist, signed_at). Generate a migration (create the drizzle baseline snapshot first, as CLAUDE.md says).
- Per-guild settings: slot types and default limits (default Tank/Healer/DPS/Flex, editable, e.g. "Main / Sub / Reserve"), reminder minutes before start (default 30).
- `/event create title start [slot limits]`: staff only. The time is entered in Asia/Bangkok (`2026-11-05 20:00`), stored in UTC, and shown with `<t:unix:F>` and `<t:unix:R>`.
- Embed with a button per slot plus Maybe / Can't go. It shows counts against limits and names, and updates live. When a slot is full, people go to the waitlist and are promoted automatically when someone leaves.
- `/event list`, `/event cancel`, `/event close`.
- Reminder exactly once, even across restarts: poll every minute and use the `reminded` flag. It pings going members only. Members' nicknames already show their IGN.
- Tests: Bangkok time parsing, slot/waitlist logic, plan changes. PR, CI, then a checklist.

## Stage 7: Attendance + points (premium)
Branch `feature/attendance`, after Stage 6 is merged.
- When an event closes, staff get "Take attendance". It lists sign-ups with present / late / absent toggles, and staff can add walk-ins.
- Per-guild point values (default present +10, late +5, signed up but absent −5), editable on the dashboard.
- `points_ledger` table (guild_id, user_id, delta, reason, event_id, created_by, created_at). Balances are computed from the ledger, never stored.
- `/points me`, `/points top [n]`, `/points adjust user delta reason` (staff). Add a points column in the roster and the CSV export.
- `#attendance-log`, with one summary embed per event.
- Tests, PR, CI, checklist.

## After Stage 7
Stop and give me:
1. what's done and live;
2. known issues;
3. your recommended next three items (candidates: payments via a Thai gateway or Discord app subscriptions, DKP bidding, tickets, bot verification at about 75 servers, MOBA/FPS template pack).
