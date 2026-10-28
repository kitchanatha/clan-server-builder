// Welcome + register, and goodbye.
// - #welcome holds a panel with a Register button. Registering = accepting the rules:
//   pick class (optional) -> enter in-game name -> nickname set, Guest role, class role.
// - #arrivals gets a greeting when someone joins and a goodbye when someone leaves.

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type ModalSubmitInteraction,
  type PartialGuildMember,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { and, eq, members, registrations } from '@csb/db';
import { classList, classRoleKey, fillTemplate, formatNickname, t, type GuildConfig } from '@csb/shared';
import { db, getConfig, getResource } from '../store.js';
import { botCanManageRole, channelKey, getRoleId, getTextChannel, upsertMessage } from '../util.js';
import { BRAND_COLOR } from './base.js';

export const REGISTER_ID = 'csb:register';
/** Old panels (before registration existed) used this id; treat it as Register. */
export const ACCEPT_RULES_ID = 'csb:accept-rules';
export const REGISTER_CLASS_ID = 'csb:reg-class';
export const REGISTER_FORM_PREFIX = 'csb:reg-form:';

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
    new ButtonBuilder().setCustomId(REGISTER_ID).setLabel(t(config.lang, 'registerButton')).setStyle(ButtonStyle.Success),
  );
  await upsertMessage(guild, 'welcome-panel', channel, { embeds: [embed], components: [row] });
}

async function welcomeConfig(guildId: string): Promise<GuildConfig | undefined> {
  const cfg = await getConfig(guildId);
  return cfg?.features.includes('welcome') ? cfg : undefined;
}

/** Step 1: Register button or /register. Shows the class picker, or goes straight to the form. */
export async function startRegistration(
  i: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
): Promise<void> {
  const config = await welcomeConfig(i.guildId);
  if (!config) {
    await i.reply({ content: t('en', 'featureOff'), flags: MessageFlags.Ephemeral });
    return;
  }
  if (!config.member.askClass) {
    await i.showModal(await registrationModal(i.guildId, i.user.id, config, ''));
    return;
  }
  const select = new StringSelectMenuBuilder()
    .setCustomId(REGISTER_CLASS_ID)
    .setPlaceholder(t(config.lang, 'pickClass'))
    .addOptions(classList(config.game, config.classes).slice(0, 25).map((c) => ({ label: c, value: c })));
  await i.reply({
    content: t(config.lang, 'pickClass'),
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

/** Step 2: class picked -> IGN form. The class rides along in the modal id. */
export async function handleRegisterClass(i: StringSelectMenuInteraction<'cached'>): Promise<void> {
  const config = await welcomeConfig(i.guildId);
  if (!config) return;
  await i.showModal(await registrationModal(i.guildId, i.user.id, config, i.values[0] ?? ''));
}

async function registrationModal(guildId: string, userId: string, config: GuildConfig, className: string) {
  const [existing] = await db
    .select({ ign: registrations.ign })
    .from(registrations)
    .where(and(eq(registrations.guildId, guildId), eq(registrations.userId, userId)))
    .limit(1);
  const ign = new TextInputBuilder()
    .setCustomId('ign')
    .setLabel(t(config.lang, 'fieldIgn'))
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(2)
    .setMaxLength(32);
  if (existing?.ign) ign.setValue(existing.ign);
  return new ModalBuilder()
    .setCustomId(REGISTER_FORM_PREFIX + className)
    .setTitle(t(config.lang, 'registerTitle'))
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(ign));
}

/** Step 3: save, set nickname, give Guest + class role. */
export async function handleRegistrationSubmit(i: ModalSubmitInteraction<'cached'>): Promise<void> {
  const config = await welcomeConfig(i.guildId);
  if (!config) return;
  const lang = config.lang;
  const className = i.customId.slice(REGISTER_FORM_PREFIX.length);
  const ign = i.fields.getTextInputValue('ign').replace(/\s+/g, ' ').trim();
  if ([...ign].length < 2 || [...ign].length > 32) {
    await i.reply({ content: t(lang, 'invalidIgn'), flags: MessageFlags.Ephemeral });
    return;
  }
  await i.deferReply({ flags: MessageFlags.Ephemeral });

  await db
    .insert(registrations)
    .values({ guildId: i.guildId, userId: i.user.id, ign, className })
    .onConflictDoUpdate({
      target: [registrations.guildId, registrations.userId],
      set: { ign, className, updatedAt: new Date() },
    });
  // Keep the roster in step if this person is already in it.
  await db
    .update(members)
    .set({ ign, ...(className ? { className } : {}), updatedAt: new Date() })
    .where(and(eq(members.guildId, i.guildId), eq(members.userId, i.user.id)));

  const member = i.member;
  const guestId = await getRoleId(i.guildId, 'guest');
  if (guestId && !member.roles.cache.has(guestId)) await member.roles.add(guestId, 'Registered').catch(() => undefined);
  if (config.member.classRoles && className) await setClassRole(member, config, className);

  const nick = formatNickname(config.member.nicknameFormat, ign, className);
  let nickOk = true;
  if (member.nickname !== nick) {
    nickOk = await member
      .setNickname(nick, 'Registered in-game name')
      .then(() => true)
      .catch(() => false);
  }
  await i.editReply(t(lang, nickOk ? 'registered' : 'nickFailed', { nick }));
}

/** Give exactly one class role (removing other class roles). Empty class = remove all. */
export async function setClassRole(member: GuildMember, config: GuildConfig, className: string): Promise<void> {
  const classes = classList(config.game, config.classes);
  const ids = await Promise.all(classes.map((c) => getRoleId(member.guild.id, classRoleKey(c))));
  const wanted = className ? await getRoleId(member.guild.id, classRoleKey(className)) : undefined;
  const remove = ids.filter((id): id is string => !!id && id !== wanted && member.roles.cache.has(id));
  if (remove.length) await member.roles.remove(remove, 'Class changed').catch(() => undefined);
  if (wanted && !member.roles.cache.has(wanted) && botCanManageRole(member.guild, wanted)) {
    await member.roles.add(wanted, 'Class role').catch(() => undefined);
  }
}

// ---- join / leave ----

export async function handleMemberJoined(member: GuildMember): Promise<void> {
  if (member.user.bot) return;
  const config = await getConfig(member.guild.id);
  if (!config?.features.includes('welcome')) return;
  const channel = await getTextChannel(member.guild, 'arrivals');
  if (!channel) return;
  const welcomeId = await getResource(member.guild.id, channelKey('welcome'));
  const text = config.member.welcomeMessage.trim() || t(config.lang, 'joinGreeting');
  await channel.send({
    content: fillTemplate(text, {
      user: `<@${member.id}>`,
      name: member.user.username,
      guild: member.guild.name,
      count: member.guild.memberCount,
      welcome: welcomeId ? `<#${welcomeId}>` : '#welcome',
    }),
    allowedMentions: { users: [member.id] },
  });
}

export async function handleMemberLeftGoodbye(member: GuildMember | PartialGuildMember): Promise<void> {
  if (member.user?.bot) return;
  const config = await getConfig(member.guild.id);
  if (!config?.features.includes('goodbye')) return;
  const channel = await getTextChannel(member.guild, 'arrivals');
  if (!channel) return;
  const [reg] = await db
    .select({ ign: registrations.ign })
    .from(registrations)
    .where(and(eq(registrations.guildId, member.guild.id), eq(registrations.userId, member.id)))
    .limit(1);
  const name = reg?.ign ?? member.nickname ?? member.user?.username ?? member.id;
  const text = config.member.goodbyeMessage.trim() || t(config.lang, 'goodbyeDefault');
  await channel.send({
    content: fillTemplate(text, {
      user: name,
      name,
      guild: member.guild.name,
      count: member.guild.memberCount,
    }),
    allowedMentions: { parse: [] },
  });
}
