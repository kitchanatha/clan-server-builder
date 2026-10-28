// Database access used by the bot.
import { and, createDb, eq, guilds, resources, type Db } from '@csb/db';
import { defaultConfig, parseConfig, type FeatureId, type GuildConfig } from '@csb/shared';
import { env } from './env.js';

export const { db, pool } = createDb(env.databaseUrl);

export type GuildRow = typeof guilds.$inferSelect;

export async function getGuild(guildId: string): Promise<GuildRow | undefined> {
  const [row] = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);
  return row;
}

/** The guild's config, or undefined when nobody configured it yet. */
export async function getConfig(guildId: string): Promise<GuildConfig | undefined> {
  const row = await getGuild(guildId);
  if (!row) return undefined;
  return parseConfig(row.config);
}

export async function hasFeature(guildId: string, feature: FeatureId): Promise<GuildConfig | undefined> {
  const cfg = await getConfig(guildId);
  return cfg && cfg.features.includes(feature) ? cfg : undefined;
}

/** Called when the bot joins a server nobody set up on the dashboard: use defaults. */
export async function ensureGuildRow(guildId: string, name: string, ownerId: string, preferredLocale: string): Promise<GuildRow> {
  const existing = await getGuild(guildId);
  if (existing) {
    const [row] = await db
      .update(guilds)
      .set({ name, botInstalled: true, updatedAt: new Date() })
      .where(eq(guilds.id, guildId))
      .returning();
    return row;
  }
  const lang = preferredLocale.startsWith('th') ? 'th' : 'en';
  const [row] = await db
    .insert(guilds)
    .values({ id: guildId, name, configuredBy: ownerId, config: defaultConfig(lang), botInstalled: true })
    .returning();
  return row;
}

export async function setInstalled(guildId: string, installed: boolean): Promise<void> {
  await db.update(guilds).set({ botInstalled: installed, updatedAt: new Date() }).where(eq(guilds.id, guildId));
}

export async function setProvisionStatus(guildId: string, status: 'queued' | 'running' | 'done' | 'error', error?: string): Promise<void> {
  await db
    .update(guilds)
    .set({
      provisionStatus: status,
      provisionError: error ?? null,
      ...(status === 'done' ? { provisionedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(guilds.id, guildId));
}

// ---- resource map: logical key -> Discord id ----

export async function loadResources(guildId: string): Promise<Map<string, string>> {
  const rows = await db.select().from(resources).where(eq(resources.guildId, guildId));
  return new Map(rows.map((r) => [r.key, r.discordId]));
}

export async function getResource(guildId: string, key: string): Promise<string | undefined> {
  const [row] = await db
    .select()
    .from(resources)
    .where(and(eq(resources.guildId, guildId), eq(resources.key, key)))
    .limit(1);
  return row?.discordId;
}

export async function setResource(guildId: string, key: string, discordId: string, dbx: Db = db): Promise<void> {
  await dbx
    .insert(resources)
    .values({ guildId, key, discordId })
    .onConflictDoUpdate({ target: [resources.guildId, resources.key], set: { discordId } });
}
