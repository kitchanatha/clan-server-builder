import { boolean, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, index } from 'drizzle-orm/pg-core';
import type { GuildConfig } from '@csb/shared';

/** One row per Discord server that has been configured on the dashboard. */
export const guilds = pgTable('guilds', {
  id: text('id').primaryKey(), // Discord guild id
  name: text('name').notNull().default(''),
  configuredBy: text('configured_by').notNull(), // Discord user id
  config: jsonb('config').$type<GuildConfig>().notNull(),
  botInstalled: boolean('bot_installed').notNull().default(false),
  /** idle | queued | running | done | error */
  provisionStatus: text('provision_status').notNull().default('idle'),
  provisionError: text('provision_error'),
  provisionedAt: timestamp('provisioned_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Maps a logical resource ("channel:general", "role:officer", "message:welcome-panel")
 * to the real Discord id, so admins can rename or move things without breaking the bot.
 */
export const resources = pgTable(
  'resources',
  {
    guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    discordId: text('discord_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.key] })],
);

/** The clan roster. */
export const members = pgTable(
  'members',
  {
    guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    ign: text('ign').notNull(),
    className: text('class_name').notNull(),
    power: integer('power').notNull().default(0),
    playtime: text('playtime').notNull().default(''),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.userId] })],
);

export const applications = pgTable(
  'applications',
  {
    id: serial('id').primaryKey(),
    guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    ign: text('ign').notNull(),
    className: text('class_name').notNull(),
    power: integer('power').notNull().default(0),
    playtime: text('playtime').notNull().default(''),
    note: text('note').notNull().default(''),
    /** pending | approved | rejected */
    status: text('status').notNull().default('pending'),
    reviewerId: text('reviewer_id'),
    messageId: text('message_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (t) => [index('applications_guild_user_idx').on(t.guildId, t.userId)],
);

/** IGN registration from the welcome Register button or /register. */
export const registrations = pgTable(
  'registrations',
  {
    guildId: text('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    ign: text('ign').notNull(),
    className: text('class_name').notNull().default(''),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.guildId, t.userId] })],
);

/** Dashboard login sessions (Discord OAuth). */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  username: text('username').notNull(),
  avatar: text('avatar'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
