import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import { eq, guilds, inArray, sessions, type Db } from '@csb/db';
import {
  CONFIG_CHANGED_CHANNEL,
  FEATURES,
  GAMES,
  TEMPLATES,
  defaultConfig,
  guildConfigSchema,
  normalizeFeatures,
  parseConfig,
  type ConfigChangedMessage,
} from '@csb/shared';
import {
  authorizeUrl,
  avatarUrl,
  botInviteUrl,
  canManage,
  exchangeCode,
  getUser,
  getUserGuilds,
  guildIconUrl,
  refreshToken,
  DiscordError,
  type DiscordPartialGuild,
  type OAuthConfig,
} from './discord.js';

export interface ServerDeps {
  db: Db;
  redis: Pick<Redis, 'publish'>;
  oauth: OAuthConfig;
  webOrigin: string;
  sessionSecret: string;
  secureCookies: boolean;
}

const SESSION_COOKIE = 'csb_sid';
const STATE_COOKIE = 'csb_oauth_state';
const SESSION_DAYS = 14;
const GUILD_CACHE_MS = 30_000;

type Session = typeof sessions.$inferSelect;

declare module 'fastify' {
  interface FastifyRequest {
    session?: Session;
  }
}

export async function buildServer(deps: ServerDeps) {
  const { db, redis, oauth } = deps;
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(cookie, { secret: deps.sessionSecret });
  await app.register(cors, { origin: deps.webOrigin, credentials: true });

  const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: deps.secureCookies, signed: true };

  // Per-session cache of the user's server list, so the dashboard doesn't hit Discord's rate limit.
  const guildCache = new Map<string, { at: number; guilds: DiscordPartialGuild[] }>();

  async function loadSession(req: FastifyRequest): Promise<Session | undefined> {
    const raw = req.cookies[SESSION_COOKIE];
    if (!raw) return undefined;
    const un = req.unsignCookie(raw);
    if (!un.valid || !un.value) return undefined;
    const [s] = await db.select().from(sessions).where(eq(sessions.id, un.value)).limit(1);
    if (!s || s.expiresAt < new Date()) return undefined;
    if (s.tokenExpiresAt.getTime() - Date.now() < 60_000 && s.refreshToken) {
      const tok = await refreshToken(oauth, s.refreshToken);
      const [updated] = await db
        .update(sessions)
        .set({
          accessToken: tok.access_token,
          refreshToken: tok.refresh_token ?? s.refreshToken,
          tokenExpiresAt: new Date(Date.now() + tok.expires_in * 1000),
        })
        .where(eq(sessions.id, s.id))
        .returning();
      return updated;
    }
    return s;
  }

  async function requireSession(req: FastifyRequest, reply: FastifyReply) {
    const s = await loadSession(req).catch(() => undefined);
    if (!s) return reply.code(401).send({ error: 'not_signed_in', message: 'Sign in with Discord first.' });
    req.session = s;
  }

  async function userGuilds(s: Session): Promise<DiscordPartialGuild[]> {
    const hit = guildCache.get(s.id);
    if (hit && Date.now() - hit.at < GUILD_CACHE_MS) return hit.guilds;
    const list = await getUserGuilds(s.accessToken);
    guildCache.set(s.id, { at: Date.now(), guilds: list });
    return list;
  }

  /** The server, if the signed-in user may manage it; otherwise replies 403. */
  async function manageableGuild(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const list = await userGuilds(req.session!);
    const g = list.find((x) => x.id === req.params.id);
    if (!g || !canManage(g)) {
      reply.code(403).send({ error: 'forbidden', message: 'You need Manage Server permission on this server.' });
      return undefined;
    }
    return g;
  }

  async function publishChange(guildId: string) {
    const msg: ConfigChangedMessage = { guildId };
    await redis.publish(CONFIG_CHANGED_CHANNEL, JSON.stringify(msg));
  }

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof DiscordError && err.status === 401) {
      return reply.code(401).send({ error: 'not_signed_in', message: 'Your Discord login expired. Sign in again.' });
    }
    app.log.error(err);
    return reply.code(500).send({ error: 'server_error', message: 'Something went wrong on our side. Try again.' });
  });

  // ---------- auth ----------

  app.get('/auth/login', async (_req, reply) => {
    const state = randomBytes(16).toString('hex');
    reply.setCookie(STATE_COOKIE, state, { ...cookieOpts, maxAge: 600 });
    return reply.redirect(authorizeUrl(oauth, state));
  });

  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/auth/callback', async (req, reply) => {
    const { code, state, error } = req.query;
    const rawState = req.cookies[STATE_COOKIE];
    const expected = rawState ? req.unsignCookie(rawState) : undefined;
    reply.clearCookie(STATE_COOKIE, { path: '/' });
    if (error || !code || !state || !expected?.valid || expected.value !== state) {
      return reply.redirect(`${deps.webOrigin}/?login=failed`);
    }
    const tok = await exchangeCode(oauth, code);
    const user = await getUser(tok.access_token);
    const id = randomBytes(32).toString('hex');
    await db.insert(sessions).values({
      id,
      userId: user.id,
      username: user.global_name ?? user.username,
      avatar: avatarUrl(user),
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? null,
      tokenExpiresAt: new Date(Date.now() + tok.expires_in * 1000),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
    });
    reply.setCookie(SESSION_COOKIE, id, { ...cookieOpts, maxAge: SESSION_DAYS * 86_400 });
    return reply.redirect(`${deps.webOrigin}/`);
  });

  app.post('/auth/logout', async (req, reply) => {
    const s = await loadSession(req).catch(() => undefined);
    if (s) {
      await db.delete(sessions).where(eq(sessions.id, s.id));
      guildCache.delete(s.id);
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  // ---------- public ----------

  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/catalog', async () => ({ games: GAMES, features: FEATURES, templates: TEMPLATES }));

  // ---------- signed in ----------

  app.register(async (r) => {
    r.addHook('preHandler', requireSession);

    r.get('/api/me', async (req) => {
      const s = req.session!;
      return { id: s.userId, username: s.username, avatar: s.avatar };
    });

    r.get('/api/guilds', async (req) => {
      const list = (await userGuilds(req.session!)).filter(canManage);
      const rows = list.length
        ? await db.select().from(guilds).where(inArray(guilds.id, list.map((g) => g.id)))
        : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      return list
        .map((g) => {
          const row = byId.get(g.id);
          return {
            id: g.id,
            name: g.name,
            icon: guildIconUrl(g),
            configured: !!row,
            botInstalled: row?.botInstalled ?? false,
            provisionStatus: row?.provisionStatus ?? 'idle',
          };
        })
        .sort((a, b) => Number(b.botInstalled) - Number(a.botInstalled) || a.name.localeCompare(b.name));
    });

    r.get<{ Params: { id: string } }>('/api/guilds/:id', async (req, reply) => {
      const g = await manageableGuild(req, reply);
      if (!g) return;
      const [row] = await db.select().from(guilds).where(eq(guilds.id, g.id)).limit(1);
      return {
        id: g.id,
        name: g.name,
        icon: guildIconUrl(g),
        config: row ? parseConfig(row.config) : defaultConfig('th'),
        configured: !!row,
        botInstalled: row?.botInstalled ?? false,
        provisionStatus: row?.provisionStatus ?? 'idle',
        provisionError: row?.provisionError ?? null,
        provisionedAt: row?.provisionedAt ?? null,
        inviteUrl: botInviteUrl(oauth.clientId, g.id),
      };
    });

    r.put<{ Params: { id: string }; Body: unknown }>('/api/guilds/:id/config', async (req, reply) => {
      const g = await manageableGuild(req, reply);
      if (!g) return;
      const parsed = guildConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_config', message: 'Some settings are not valid.', issues: parsed.error.issues });
      }
      const config = { ...parsed.data, features: normalizeFeatures(parsed.data.features) };
      const [row] = await db
        .insert(guilds)
        .values({ id: g.id, name: g.name, configuredBy: req.session!.userId, config, provisionStatus: 'queued' })
        .onConflictDoUpdate({
          target: guilds.id,
          set: { name: g.name, config, provisionStatus: 'queued', provisionError: null, updatedAt: new Date() },
        })
        .returning();
      if (row.botInstalled) await publishChange(g.id);
      return { ok: true, botInstalled: row.botInstalled, config };
    });

    r.post<{ Params: { id: string } }>('/api/guilds/:id/resync', async (req, reply) => {
      const g = await manageableGuild(req, reply);
      if (!g) return;
      await db.update(guilds).set({ provisionStatus: 'queued', updatedAt: new Date() }).where(eq(guilds.id, g.id));
      await publishChange(g.id);
      return { ok: true };
    });
  });

  // Bot invite without a preselected server (used before the user has one).
  app.get('/api/invite', async () => ({ url: botInviteUrl(oauth.clientId) }));

  return app;
}
