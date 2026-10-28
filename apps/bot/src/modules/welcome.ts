// Welcome + verify: a panel in #welcome with an "I accept the rules" button that
// gives the Guest role, which unlocks the "verified" channels.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type Guild,
} from 'discord.js';
import { t, type GuildConfig } from '@csb/shared';
import { getResource, hasFeature } from '../store.js';
import { channelKey, getRoleId, getTextChannel, upsertMessage } from '../util.js';
import { BRAND_COLOR } from './base.js';

export const ACCEPT_RULES_ID = 'csb:accept-rules';

export async function postWelcomePanel(guild: Guild, config: GuildConfig): Promise<void> {
  const channel = await getTextChannel(guild, 'welcome');
  if (!channel) return;
  const rulesId = await getResource(guild.id, channelKey('rules'));
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(t(config.lang, 'welcomeTitle', { guild: guild.name }))
    .setDescription(t(config.lang, 'welcomeBody', { rules: rulesId ? `<#${rulesId}>` : '#rules' }));
  if (guild.iconURL()) embed.setThumbnail(guild.iconURL());
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(ACCEPT_RULES_ID).setLabel(t(config.lang, 'acceptRules')).setStyle(ButtonStyle.Success),
  );
  await upsertMessage(guild, 'welcome-panel', channel, { embeds: [embed], components: [row] });
}

export async function handleAcceptRules(i: ButtonInteraction<'cached'>): Promise<void> {
  const config = await hasFeature(i.guildId, 'welcome');
  if (!config) {
    await i.reply({ content: t('en', 'featureOff'), flags: MessageFlags.Ephemeral });
    return;
  }
  const guestId = await getRoleId(i.guildId, 'guest');
  if (!guestId) {
    await i.reply({ content: t(config.lang, 'notSetUp'), flags: MessageFlags.Ephemeral });
    return;
  }
  if (i.member.roles.cache.has(guestId)) {
    await i.reply({ content: t(config.lang, 'alreadyAccepted'), flags: MessageFlags.Ephemeral });
    return;
  }
  await i.member.roles.add(guestId, 'Accepted the rules');
  await i.reply({ content: t(config.lang, 'acceptedRules'), flags: MessageFlags.Ephemeral });
}
