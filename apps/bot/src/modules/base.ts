import { EmbedBuilder, type Guild } from 'discord.js';
import { t, type GuildConfig } from '@csb/shared';
import { getTextChannel, upsertMessage } from '../util.js';

export const BRAND_COLOR = 0xe0a14a;

export function rulesLines(config: GuildConfig): string[] {
  return config.rules
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Post (or refresh) the rules embed in #rules. */
export async function postRules(guild: Guild, config: GuildConfig): Promise<void> {
  const channel = await getTextChannel(guild, 'rules');
  if (!channel) return;
  const lines = rulesLines(config);
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(t(config.lang, 'rulesTitle'))
    .setDescription(lines.length ? lines.map((l, i) => `**${i + 1}.** ${l}`).join('\n') : '—');
  await upsertMessage(guild, 'rules', channel, { embeds: [embed] });
}
