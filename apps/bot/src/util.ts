import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type MessageCreateOptions,
  type MessageEditOptions,
  type TextChannel,
} from 'discord.js';
import type { RoleKey } from '@csb/shared';
import { getResource, setResource } from './store.js';

/** Resource key for a planned role: rank key ("officer") or "class:..." / "ping:...". */
export const roleKey = (k: string) => `role:${k}`;
export const channelKey = (k: string) => `channel:${k}`;
export const categoryKey = (k: string) => `category:${k}`;
export const messageKey = (k: string) => `message:${k}`;

export async function getRoleId(guildId: string, key: RoleKey | string): Promise<string | undefined> {
  return getResource(guildId, roleKey(key));
}

/** Officers, Leaders, and anyone with Manage Server count as staff. */
export async function isStaff(member: GuildMember): Promise<boolean> {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const [officer, leader] = await Promise.all([
    getRoleId(member.guild.id, 'officer'),
    getRoleId(member.guild.id, 'leader'),
  ]);
  return [officer, leader].some((id) => id && member.roles.cache.has(id));
}

export async function getTextChannel(guild: Guild, key: string): Promise<TextChannel | undefined> {
  const id = await getResource(guild.id, channelKey(key));
  if (!id) return undefined;
  const ch = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
  return ch && ch.type === ChannelType.GuildText ? ch : undefined;
}

/**
 * Keep one bot message per logical key in a channel: edit it if it still exists,
 * otherwise post a new one and remember its id.
 */
export async function upsertMessage(
  guild: Guild,
  key: string,
  channel: TextChannel,
  payload: MessageCreateOptions & MessageEditOptions,
): Promise<void> {
  const id = await getResource(guild.id, messageKey(key));
  if (id) {
    const existing = await channel.messages.fetch(id).catch(() => null);
    if (existing && existing.author.id === guild.client.user.id) {
      await existing.edit(payload);
      return;
    }
  }
  const sent = await channel.send(payload);
  await setResource(guild.id, messageKey(key), sent.id);
}

/** True when the member is a Leader or has Manage Server (may hand out Officer and Leader). */
export async function isLeader(member: GuildMember): Promise<boolean> {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  const leader = await getRoleId(member.guild.id, 'leader');
  return !!leader && member.roles.cache.has(leader);
}

/** Whether the bot can assign this role (it must sit below the bot's highest role). */
export function botCanManageRole(guild: Guild, roleId: string): boolean {
  const role = guild.roles.cache.get(roleId);
  const me = guild.members.me;
  return !!role && !!me && !role.managed && me.roles.highest.comparePositionTo(role) > 0;
}

/** Accepts '1,234,567', '1 234 567' or '1234567'. */
export function parsePower(raw: string): number | null {
  const cleaned = raw.replace(/[,\s._]/g, '');
  if (!/^\d{1,10}$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n <= 2_000_000_000 ? n : null;
}
