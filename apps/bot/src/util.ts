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

export const roleKey = (k: RoleKey) => `role:${k}`;
export const channelKey = (k: string) => `channel:${k}`;
export const categoryKey = (k: string) => `category:${k}`;
export const messageKey = (k: string) => `message:${k}`;

export async function getRoleId(guildId: string, key: RoleKey): Promise<string | undefined> {
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

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Accepts '1,234,567', '1 234 567' or '1234567'. */
export function parsePower(raw: string): number | null {
  const cleaned = raw.replace(/[,\s._]/g, '');
  if (!/^\d{1,10}$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n <= 2_000_000_000 ? n : null;
}
