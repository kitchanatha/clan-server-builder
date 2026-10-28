// Role management:
// - #pick-roles panel: members pick their class role (one) and alert roles (any).
// - /rank set|remove: officers manage ranks; only Leaders can hand out Officer/Leader.

import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { and, eq, registrations } from '@csb/db';
import { classList, pingRoleKey, t, type GuildConfig, type RoleKey } from '@csb/shared';
import { db, getConfig } from '../store.js';
import { botCanManageRole, getRoleId, getTextChannel, isLeader, isStaff, upsertMessage } from '../util.js';
import { BRAND_COLOR } from './base.js';
import { setClassRole } from './welcome.js';

export const PICK_CLASS_ID = 'csb:pick-class';
export const PICK_PING_ID = 'csb:pick-ping';
const NO_CLASS = '__none__';

export const RANKS: readonly RoleKey[] = ['leader', 'officer', 'member', 'guest'];

export async function postPickRolesPanel(guild: Guild, config: GuildConfig): Promise<void> {
  const channel = await getTextChannel(guild, 'pick-roles');
  if (!channel) return;
  const lang = config.lang;
  const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [];

  if (config.member.classRoles) {
    const classes = classList(config.game, config.classes).slice(0, 24);
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(PICK_CLASS_ID)
          .setPlaceholder(t(lang, 'pickClassPlaceholder'))
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions([{ label: '—', value: NO_CLASS }, ...classes.map((c) => ({ label: c, value: c }))]),
      ),
    );
  }
  const pings = config.member.pingRoles;
  if (pings.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(PICK_PING_ID)
          .setPlaceholder(t(lang, 'pickPingPlaceholder'))
          .setMinValues(0)
          .setMaxValues(pings.length)
          .addOptions(pings.map((p) => ({ label: p, value: p }))),
      ),
    );
  }
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(t(lang, 'pickRolesTitle'))
    .setDescription(t(lang, 'pickRolesBody'));
  await upsertMessage(guild, 'pick-roles-panel', channel, { embeds: [embed], components: rows });
}

async function rolesConfig(guildId: string): Promise<GuildConfig | undefined> {
  const cfg = await getConfig(guildId);
  return cfg?.features.includes('roles') ? cfg : undefined;
}

export async function handlePickClass(i: StringSelectMenuInteraction<'cached'>): Promise<void> {
  const config = await rolesConfig(i.guildId);
  if (!config) return;
  const value = i.values[0] ?? NO_CLASS;
  const className = value === NO_CLASS ? '' : value;
  await setClassRole(i.member, config, className);
  if (className) {
    await db
      .update(registrations)
      .set({ className, updatedAt: new Date() })
      .where(and(eq(registrations.guildId, i.guildId), eq(registrations.userId, i.user.id)));
  }
  await i.reply({ content: t(config.lang, 'rolesUpdated'), flags: MessageFlags.Ephemeral });
}

export async function handlePickPing(i: StringSelectMenuInteraction<'cached'>): Promise<void> {
  const config = await rolesConfig(i.guildId);
  if (!config) return;
  const chosen = new Set(i.values);
  const add: string[] = [];
  const remove: string[] = [];
  for (const p of config.member.pingRoles) {
    const id = await getRoleId(i.guildId, pingRoleKey(p));
    if (!id || !botCanManageRole(i.guild, id)) continue;
    const has = i.member.roles.cache.has(id);
    if (chosen.has(p) && !has) add.push(id);
    if (!chosen.has(p) && has) remove.push(id);
  }
  if (add.length) await i.member.roles.add(add, 'Picked alert roles');
  if (remove.length) await i.member.roles.remove(remove, 'Picked alert roles');
  await i.reply({ content: t(config.lang, 'rolesUpdated'), flags: MessageFlags.Ephemeral });
}

/** /rank set user rank, /rank remove user */
export async function handleRank(i: ChatInputCommandInteraction<'cached'>): Promise<void> {
  const config = await rolesConfig(i.guildId);
  if (!config) {
    await i.reply({ content: t('en', 'featureOff'), flags: MessageFlags.Ephemeral });
    return;
  }
  const lang = config.lang;
  if (!(await isStaff(i.member))) {
    await i.reply({ content: t(lang, 'staffOnly'), flags: MessageFlags.Ephemeral });
    return;
  }
  const user = i.options.getUser('user', true);
  if (user.id === i.user.id) {
    await i.reply({ content: t(lang, 'cannotTargetSelf'), flags: MessageFlags.Ephemeral });
    return;
  }
  const target = await i.guild.members.fetch(user.id).catch(() => null);
  if (!target) {
    await i.reply({ content: t(lang, 'notSetUp'), flags: MessageFlags.Ephemeral });
    return;
  }

  const rankIds = new Map<RoleKey, string>();
  for (const r of RANKS) {
    const id = await getRoleId(i.guildId, r);
    if (id) rankIds.set(r, id);
  }
  // Only Leaders may touch someone who is already an Officer or Leader.
  const targetIsStaff = ['officer', 'leader'].some((r) => {
    const id = rankIds.get(r as RoleKey);
    return id && target.roles.cache.has(id);
  });
  const leader = await isLeader(i.member);

  const sub = i.options.getSubcommand();
  const rank = sub === 'set' ? (i.options.getString('rank', true) as RoleKey) : undefined;
  if (((rank === 'officer' || rank === 'leader') || targetIsStaff) && !leader) {
    await i.reply({ content: t(lang, 'leaderOnly'), flags: MessageFlags.Ephemeral });
    return;
  }
  const wanted = rank ? rankIds.get(rank) : undefined;
  if (rank && !wanted) {
    await i.reply({ content: t(lang, 'notSetUp'), flags: MessageFlags.Ephemeral });
    return;
  }
  if (wanted && !botCanManageRole(i.guild, wanted)) {
    await i.reply({ content: t(lang, 'roleTooHigh'), flags: MessageFlags.Ephemeral });
    return;
  }

  const remove = [...rankIds.values()].filter((id) => id !== wanted && target.roles.cache.has(id) && botCanManageRole(i.guild, id));
  if (remove.length) await target.roles.remove(remove, `Rank changed by ${i.user.username}`);
  if (wanted && !target.roles.cache.has(wanted)) await target.roles.add(wanted, `Rank set by ${i.user.username}`);

  const content = rank
    ? t(lang, 'rankSet', { user: `<@${target.id}>`, rank: config.ranks[rank] })
    : t(lang, 'rankRemoved', { user: `<@${target.id}>` });
  await i.reply({ content, allowedMentions: { parse: [] }, flags: MessageFlags.Ephemeral });
}
