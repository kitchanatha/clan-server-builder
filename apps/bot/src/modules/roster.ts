// Roster: /profile to add or update yourself, /roster view|export|remove,
// and a live roster board in #roster that refreshes on every change.

import {
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Guild,
} from 'discord.js';
import { and, desc, eq, members } from '@csb/db';
import { getGame, t, type GuildConfig, type Lang } from '@csb/shared';
import { db, getConfig, hasFeature } from '../store.js';
import { getRoleId, getTextChannel, isStaff, parsePower, upsertMessage } from '../util.js';
import { BRAND_COLOR } from './base.js';

type MemberRow = typeof members.$inferSelect;

const BOARD_LIMIT = 50;

async function listMembers(guildId: string, className?: string): Promise<MemberRow[]> {
  const where = className
    ? and(eq(members.guildId, guildId), eq(members.className, className))
    : eq(members.guildId, guildId);
  return db.select().from(members).where(where).orderBy(desc(members.power));
}

export function rosterEmbed(rows: MemberRow[], lang: Lang, limit = BOARD_LIMIT): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle(t(lang, 'rosterTitle', { count: rows.length }));
  if (!rows.length) return embed.setDescription(t(lang, 'rosterEmpty'));
  // Group by class, strongest first inside each class.
  const byClass = new Map<string, MemberRow[]>();
  for (const r of rows.slice(0, limit)) byClass.set(r.className, [...(byClass.get(r.className) ?? []), r]);
  for (const [cls, list] of [...byClass].sort((a, b) => b[1].length - a[1].length)) {
    const lines = list.map((m) => `\`${m.power.toLocaleString('en-US').padStart(11)}\`  ${m.ign}  <@${m.userId}>`);
    embed.addFields({ name: `${cls} · ${list.length}`, value: lines.join('\n').slice(0, 1024) });
  }
  if (rows.length > limit) embed.setFooter({ text: t(lang, 'rosterMore', { count: rows.length - limit }) });
  return embed.setTimestamp(new Date());
}

/** Refresh the pinned roster board in #roster. */
export async function refreshRoster(guild: Guild): Promise<void> {
  const config = await getConfig(guild.id);
  if (!config?.features.includes('roster')) return;
  const channel = await getTextChannel(guild, 'roster');
  if (!channel) return;
  const rows = await listMembers(guild.id);
  await upsertMessage(guild, 'roster-board', channel, { embeds: [rosterEmbed(rows, config.lang)], allowedMentions: { parse: [] } });
}

export function toCsv(rows: MemberRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['discord_id', 'in_game_name', 'class', 'power', 'playtime', 'joined_at'];
  const body = rows.map((r) => [r.userId, r.ign, r.className, r.power, r.playtime, r.joinedAt.toISOString()].map(esc).join(','));
  // BOM so Excel opens Thai text correctly
  return '﻿' + [header.join(','), ...body].join('\n');
}

async function requireRoster(i: ChatInputCommandInteraction<'cached'>): Promise<GuildConfig | undefined> {
  const config = await hasFeature(i.guildId, 'roster');
  if (!config) await i.reply({ content: t('en', 'featureOff'), flags: MessageFlags.Ephemeral });
  return config;
}

/** /profile ign class power [playtime] */
export async function handleProfile(i: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const config = await requireRoster(i);
  if (!config) return;
  const lang = config.lang;
  // With recruitment on, only approved members (or staff) can add themselves.
  if (config.features.includes('recruit')) {
    const memberRole = await getRoleId(i.guildId, 'member');
    const ok = (memberRole && i.member.roles.cache.has(memberRole)) || (await isStaff(i.member));
    if (!ok) {
      await i.reply({ content: t(lang, 'notInRoster'), flags: MessageFlags.Ephemeral });
      return;
    }
  }
  const power = parsePower(i.options.getString('power', true));
  if (power === null) {
    await i.reply({ content: t(lang, 'invalidPower'), flags: MessageFlags.Ephemeral });
    return;
  }
  const values = {
    ign: i.options.getString('ign', true).trim().slice(0, 32),
    className: i.options.getString('class', true).trim().slice(0, 32),
    playtime: (i.options.getString('playtime') ?? '').trim().slice(0, 100),
    power,
  };
  await db
    .insert(members)
    .values({ guildId: i.guildId, userId: i.user.id, ...values })
    .onConflictDoUpdate({ target: [members.guildId, members.userId], set: { ...values, updatedAt: new Date() } });
  await i.reply({ content: t(lang, 'profileSaved'), flags: MessageFlags.Ephemeral });
  await refreshRoster(i.guild);
}

/** /roster view [class] | export | remove user */
export async function handleRoster(i: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const config = await requireRoster(i);
  if (!config) return;
  const lang = config.lang;
  const sub = i.options.getSubcommand();

  if (sub === 'view') {
    const rows = await listMembers(i.guildId, i.options.getString('class') ?? undefined);
    await i.reply({ embeds: [rosterEmbed(rows, lang, 30)], allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
    return;
  }

  if (!(await isStaff(i.member))) {
    await i.reply({ content: t(lang, 'staffOnly'), flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'export') {
    const rows = await listMembers(i.guildId);
    const file = new AttachmentBuilder(Buffer.from(toCsv(rows), 'utf8'), { name: `roster-${i.guildId}.csv` });
    await i.reply({ content: t(lang, 'exportReady'), files: [file], flags: MessageFlags.Ephemeral });
    return;
  }

  if (sub === 'remove') {
    const user = i.options.getUser('user', true);
    await db.delete(members).where(and(eq(members.guildId, i.guildId), eq(members.userId, user.id)));
    await i.reply({ content: t(lang, 'removedFromRoster', { user: user.username }), flags: MessageFlags.Ephemeral });
    await refreshRoster(i.guild);
  }
}

/** Class autocomplete for /profile and /roster view, from the server's game preset. */
export async function handleClassAutocomplete(i: AutocompleteInteraction<'cached'>): Promise<void> {
  const config = await getConfig(i.guildId);
  const classes = config ? getGame(config.game).classes : [];
  const typed = String(i.options.getFocused()).toLowerCase();
  await i.respond(
    classes
      .filter((c) => c.toLowerCase().includes(typed))
      .slice(0, 25)
      .map((c) => ({ name: c, value: c })),
  );
}

/** Someone left the server: drop them from the roster. */
export async function handleMemberLeft(guild: Guild, userId: string): Promise<void> {
  const deleted = await db
    .delete(members)
    .where(and(eq(members.guildId, guild.id), eq(members.userId, userId)))
    .returning({ userId: members.userId });
  if (deleted.length) await refreshRoster(guild);
}
