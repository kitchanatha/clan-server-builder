# Clan Server Builder

A website where an MMO guild leader picks a game and features, and one shared Discord bot builds and runs the server: channels, roles, permissions, a welcome/verify gate, recruitment, and a roster. Thai and English throughout.

Free modules: **Base layout**, **Welcome + register**, **Goodbye**, **Role management**, **Recruitment**, **Roster**. Raid sign-ups, attendance/points, tickets and DKP are in the catalog as "coming soon".

Templates on the dashboard set a starting feature list: **Member management** (welcome, register, goodbye, roles), **Recruiting guild** (+ applications and roster), **Everything**. Each guild then customizes its own rank names, class list, nickname format, welcome/goodbye text, class roles and alert roles.

Launch presets: **Aion 2 (Global)**, **Ragnarok The New World**, and **Any MMO**.

## How it works

```
Leader ─► Dashboard (apps/web) ─► API (apps/api) ─► PostgreSQL
              │                       │
              └─ Discord OAuth        └─► Redis "config changed" ─► Bot (apps/bot) ─► Discord
```

1. The leader signs in with Discord on the dashboard and picks one of their servers (Manage Server needed).
2. They choose a game, toggle features, edit the rules, and save. The right-hand preview uses the same `buildPlan()` the bot uses, so the preview is exactly what gets built.
3. They press **Add the bot**. Discord no longer lets bots create servers, so the user creates the server; the bot configures it.
4. When the bot joins (or a saved change arrives over Redis), it provisions the server. Provisioning is idempotent: roles, categories and channels are found through the `resources` table (logical key → Discord id) or by name, and reused. Turning a feature off never deletes channels.

## Repo layout

| Path | What it is |
| --- | --- |
| `packages/shared` | Feature catalog, game presets, `buildPlan()`, config schema, bot messages (TH/EN). Pure, unit-tested. |
| `packages/db` | Drizzle schema + SQL migrations (guilds, resources, members, applications, sessions). |
| `apps/bot` | discord.js v14 bot: provisioner and the four modules. |
| `apps/api` | Fastify API: Discord OAuth login, server list, save config, invite link. |
| `apps/web` | Vite + React dashboard. |

## Run it locally

Requirements: Node 20+, Docker.

1. **Create a Discord application** at <https://discord.com/developers/applications>.
   - *Bot* tab: copy the token, and turn on **Server Members Intent** (needed for roles on join/leave).
   - *OAuth2* tab: copy Client ID and Client Secret, and add the redirect `http://localhost:3001/auth/callback`.
2. Copy the env file and fill it in:
   ```bash
   cp .env.example .env
   ```
   For fast testing, set `DEV_GUILD_ID` to a test server's id so slash commands appear instantly.
3. Start Postgres and Redis, install, migrate:
   ```bash
   docker compose up -d
   npm install
   npm run db:migrate
   ```
4. Run the three apps (separate terminals):
   ```bash
   npm run dev:api
   npm run dev:bot
   npm run dev:web
   ```
5. Open <http://localhost:5173>, sign in, pick a test server, save, then **Add the bot**.

## What the bot builds (all four modules on)

| Category | Channels | Who can see |
| --- | --- | --- |
| INFO | #announcements, #rules, #welcome, #arrivals | Everyone, read-only |
| INFO | #pick-roles | After registering, read-only |
| RECRUITMENT | #apply-here | After registering, read-only |
| CHAT | #general, #screenshots | After registering |
| GUILD | #guild-chat, #roster | Members |
| STAFF | #applications, #officer-chat | Officers, Leaders |
| VOICE | Lobby; Party 1, Party 2 | After registering; Members |

Ranks: **Leader** (given to the server owner), **Officer**, **Member**, **Guest** (from registering). Each guild can rename them. Optional class roles and alert roles are added when turned on.

The bot's role must sit **above** these roles in Server Settings → Roles, or it can't assign them. It asks only for Manage Roles, Manage Channels, View, Send, Embed, Attach, Read History, Manage Messages and Connect, never Administrator.

## Member management

- **Register:** new members press **Register** in #welcome (or use `/register`), pick their class if the guild asks for it, and type their in-game name. The bot sets their nickname using the guild's format (e.g. `[Cleric] Boom`), gives the Guest rank (unlocking the server) and, if class roles are on, their class role. Registering again updates the name.
- **Welcome / goodbye:** a greeting in #arrivals when someone joins, and a goodbye when they leave (shows their registered IGN). Text is customizable with `{user} {name} {guild} {count} {welcome}`.
- **Pick roles:** #pick-roles has menus for the class role (one) and alert roles (any, e.g. Raid Alerts, Guild War).
- **Ranks:** `/rank set user rank` and `/rank remove user`. Officers can set Member/Guest; only Leaders (or Manage Server) can give or take Officer/Leader.

The bot needs **Manage Nicknames** for registration. Servers that installed the bot before this feature should re-invite it from the dashboard to add that permission. The bot can't rename the server owner; they get a message asking them to set it themselves.

## Slash commands

| Command | Who | What |
| --- | --- | --- |
| `/register` | Anyone | Register or update your in-game name and class |
| `/rank set user rank` / `/rank remove user` | Staff | Change ranks (Officer/Leader: Leaders only) |
| `/apply` | Anyone | Same as the Apply button: pick class → form → goes to #applications |
| `/profile ign class power [playtime]` | Members | Add or update your roster entry (class autocompletes from the game preset) |
| `/roster view [class]` | Members | Roster sorted by power |
| `/roster export` | Staff | CSV download (opens correctly in Excel with Thai text) |
| `/roster remove user` | Staff | Remove someone |

Officers approve or reject applications with buttons in #applications. Approval gives the Member role, removes Guest, adds the player to the roster, refreshes the #roster board, and DMs the player.

## Scripts

| Script | Does |
| --- | --- |
| `npm run typecheck` | Builds shared libs, type-checks bot, API and web |
| `npm test` | Unit tests (plan builder, config schema, OAuth URLs) |
| `npm run build` | Production build of everything |
| `npm run db:migrate` | Applies `packages/db/migrations` |

## Not in Phase 1 yet

- Raid / war sign-ups, attendance + points, tickets, DKP (Phase 2–3)
- Payments and premium tiers
- Bot verification (needed past 100 servers; apply early because of the Server Members intent)
- Sharding (needed at 2,500 servers)
