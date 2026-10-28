// Recruitment: Apply button / /apply -> pick class -> form -> officers approve or
// reject in #applications -> approved players get the Member role and a roster entry.

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
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { and, applications, eq, members } from '@csb/db';
import { getGame, t, type GuildConfig } from '@csb/shared';
import { db, hasFeature } from '../store.js';
import { getRoleId, getTextChannel, isStaff, parsePower, upsertMessage } from '../util.js';
import { BRAND_COLOR } from './base.js';
import { refreshRoster } from './roster.js';

export const APPLY_ID = 'csb:apply';
export const APPLY_CLASS_ID = 'csb:apply-class';
export const APPLY_FORM_PREFIX = 'csb:apply-form:';
export const APPROVE_PREFIX = 'csb:app-approve:';
export const REJECT_PREFIX = 'csb:app-reject:';

const STATUS_COLOR = { pending: 0x4f8fd6, approved: 0x2f8a57, rejected: 0xb3412e } as const;

export async function postApplyPanel(guild: Guild, config: GuildConfig): Promise<void> {
  const channel = await getTextChannel(guild, 'apply');
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(t(config.lang, 'applyTitle'))
    .setDescription(t(config.lang, 'applyBody'))
    .setFooter({ text: getGame(config.game).name });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(APPLY_ID).setLabel(t(config.lang, 'applyButton')).setStyle(ButtonStyle.Primary),
  );
  await upsertMessage(guild, 'apply-panel', channel, { embeds: [embed], components: [row] });
}

/** Step 1: Apply button or /apply. Checks eligibility, then shows the class picker. */
export async function startApplication(
  i: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
): Promise<void> {
  const config = await hasFeature(i.guildId, 'recruit');
  if (!config) {
    await i.reply({ content: t('en', 'featureOff'), flags: MessageFlags.Ephemeral });
    return;
  }
  const memberRole = await getRoleId(i.guildId, 'member');
  if (memberRole && i.member.roles.cache.has(memberRole)) {
    await i.reply({ content: t(config.lang, 'alreadyMember'), flags: MessageFlags.Ephemeral });
    return;
  }
  const [pending] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.guildId, i.guildId), eq(applications.userId, i.user.id), eq(applications.status, 'pending')))
    .limit(1);
  if (pending) {
    await i.reply({ content: t(config.lang, 'alreadyPending'), flags: MessageFlags.Ephemeral });
    return;
  }
  const select = new StringSelectMenuBuilder()
    .setCustomId(APPLY_CLASS_ID)
    .setPlaceholder(t(config.lang, 'pickClass'))
    .addOptions(getGame(config.game).classes.slice(0, 25).map((c) => ({ label: c, value: c })));
  await i.reply({
    content: t(config.lang, 'pickClass'),
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

/** Step 2: class picked -> open the form. The class rides along in the modal id. */
export async function handleClassPicked(i: StringSelectMenuInteraction<'cached'>): Promise<void> {
  const config = await hasFeature(i.guildId, 'recruit');
  if (!config) return;
  const className = i.values[0];
  const lang = config.lang;
  const input = (id: string, label: string, style: TextInputStyle, required: boolean, max: number) =>
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max),
    );
  const modal = new ModalBuilder()
    .setCustomId(APPLY_FORM_PREFIX + className)
    .setTitle(`${t(lang, 'formTitle')} · ${className}`.slice(0, 45))
    .addComponents(
      input('ign', t(lang, 'fieldIgn'), TextInputStyle.Short, true, 32),
      input('power', t(lang, 'fieldPower'), TextInputStyle.Short, true, 12),
      input('playtime', t(lang, 'fieldPlaytime'), TextInputStyle.Short, false, 100),
      input('note', t(lang, 'fieldNote'), TextInputStyle.Paragraph, false, 500),
    );
  await i.showModal(modal);
}

/** Step 3: form submitted -> save and post to #applications. */
export async function handleApplicationSubmit(i: ModalSubmitInteraction<'cached'>): Promise<void> {
  const config = await hasFeature(i.guildId, 'recruit');
  if (!config) return;
  const lang = config.lang;
  const className = i.customId.slice(APPLY_FORM_PREFIX.length);
  const power = parsePower(i.fields.getTextInputValue('power'));
  if (power === null) {
    await i.reply({ content: t(lang, 'invalidPower'), flags: MessageFlags.Ephemeral });
    return;
  }
  const [app] = await db
    .insert(applications)
    .values({
      guildId: i.guildId,
      userId: i.user.id,
      className,
      power,
      ign: i.fields.getTextInputValue('ign').trim(),
      playtime: i.fields.getTextInputValue('playtime').trim(),
      note: i.fields.getTextInputValue('note').trim(),
    })
    .returning();

  const channel = await getTextChannel(i.guild, 'applications');
  if (channel) {
    const msg = await channel.send(applicationMessage(app, lang, i.user.id));
    await db.update(applications).set({ messageId: msg.id }).where(eq(applications.id, app.id));
  }
  await i.reply({ content: t(lang, 'applied'), flags: MessageFlags.Ephemeral });
}

type AppRow = typeof applications.$inferSelect;

function applicationMessage(app: AppRow, lang: GuildConfig['lang'], userId: string, footer?: string) {
  const embed = new EmbedBuilder()
    .setColor(STATUS_COLOR[app.status as keyof typeof STATUS_COLOR] ?? STATUS_COLOR.pending)
    .setTitle(`${t(lang, 'newApplication')} #${app.id}`)
    .setDescription(`<@${userId}>`)
    .addFields(
      { name: t(lang, 'fieldIgn'), value: app.ign || '—', inline: true },
      { name: 'Class', value: app.className, inline: true },
      { name: t(lang, 'fieldPower'), value: app.power.toLocaleString('en-US'), inline: true },
      { name: t(lang, 'fieldPlaytime'), value: app.playtime || '—' },
      { name: t(lang, 'fieldNote'), value: app.note || '—' },
    )
    .setTimestamp(app.createdAt);
  if (footer) embed.setFooter({ text: footer });
  const done = app.status !== 'pending';
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(APPROVE_PREFIX + app.id).setLabel(t(lang, 'approve')).setStyle(ButtonStyle.Success).setDisabled(done),
    new ButtonBuilder().setCustomId(REJECT_PREFIX + app.id).setLabel(t(lang, 'reject')).setStyle(ButtonStyle.Danger).setDisabled(done),
  );
  return { embeds: [embed], components: [row] };
}

/** Step 4: an officer approves or rejects. */
export async function handleReview(i: ButtonInteraction<'cached'>, approve: boolean): Promise<void> {
  const config = await hasFeature(i.guildId, 'recruit');
  if (!config) return;
  const lang = config.lang;
  if (!(await isStaff(i.member))) {
    await i.reply({ content: t(lang, 'staffOnly'), flags: MessageFlags.Ephemeral });
    return;
  }
  const id = Number(i.customId.slice((approve ? APPROVE_PREFIX : REJECT_PREFIX).length));
  // Only a pending application can be reviewed; the WHERE makes double clicks safe.
  const [app] = await db
    .update(applications)
    .set({ status: approve ? 'approved' : 'rejected', reviewerId: i.user.id, reviewedAt: new Date() })
    .where(and(eq(applications.id, id), eq(applications.guildId, i.guildId), eq(applications.status, 'pending')))
    .returning();
  if (!app) {
    await i.reply({ content: t(lang, 'alreadyReviewed'), flags: MessageFlags.Ephemeral });
    return;
  }

  const applicant = await i.guild.members.fetch(app.userId).catch(() => null);
  if (approve) {
    const [memberRole, guestRole] = await Promise.all([getRoleId(i.guildId, 'member'), getRoleId(i.guildId, 'guest')]);
    if (applicant && memberRole) await applicant.roles.add(memberRole, `Application #${app.id} approved`).catch(() => undefined);
    if (applicant && guestRole) await applicant.roles.remove(guestRole).catch(() => undefined);
    await db
      .insert(members)
      .values({ guildId: app.guildId, userId: app.userId, ign: app.ign, className: app.className, power: app.power, playtime: app.playtime })
      .onConflictDoUpdate({
        target: [members.guildId, members.userId],
        set: { ign: app.ign, className: app.className, power: app.power, playtime: app.playtime, updatedAt: new Date() },
      });
  }

  const footer = t(lang, approve ? 'approvedBy' : 'rejectedBy', { user: i.user.username });
  await i.update(applicationMessage(app, lang, app.userId, footer));
  if (applicant) {
    await applicant
      .send(t(lang, approve ? 'dmApproved' : 'dmRejected', { guild: i.guild.name }))
      .catch(() => undefined); // DMs closed
  }
  if (approve && config.features.includes('roster')) await refreshRoster(i.guild);
}
