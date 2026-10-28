import { Client, Events, GatewayIntentBits, MessageFlags, Partials, type Interaction } from 'discord.js';
import { Redis } from 'ioredis';
import { CONFIG_CHANGED_CHANNEL, type ConfigChangedMessage } from '@csb/shared';
import { env } from './env.js';
import { registerCommands } from './commands.js';
import { provisionGuild } from './provision.js';
import { ensureGuildRow, getGuild, pool, setInstalled } from './store.js';
import { ACCEPT_RULES_ID, handleAcceptRules } from './modules/welcome.js';
import {
  APPLY_CLASS_ID,
  APPLY_FORM_PREFIX,
  APPLY_ID,
  APPROVE_PREFIX,
  REJECT_PREFIX,
  handleApplicationSubmit,
  handleClassPicked,
  handleReview,
  startApplication,
} from './modules/recruit.js';
import { handleClassAutocomplete, handleMemberLeft, handleProfile, handleRoster } from './modules/roster.js';

const client = new Client({
  // GuildMembers is a privileged intent: turn on "Server Members Intent" in the developer portal.
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`[bot] logged in as ${c.user.tag}, in ${c.guilds.cache.size} servers`);
  await registerCommands().catch((e) => console.error('[commands] registration failed', e));
  // Catch up on servers that joined or changed config while the bot was offline.
  for (const guild of c.guilds.cache.values()) {
    const row = await getGuild(guild.id);
    if (!row || !row.botInstalled) {
      await ensureGuildRow(guild.id, guild.name, guild.ownerId, guild.preferredLocale);
      void provisionGuild(guild);
    } else if (row.provisionStatus === 'queued' || row.provisionStatus === 'running') {
      void provisionGuild(guild);
    }
  }
});

client.on(Events.GuildCreate, async (guild) => {
  console.log(`[bot] joined ${guild.name} (${guild.id})`);
  await ensureGuildRow(guild.id, guild.name, guild.ownerId, guild.preferredLocale);
  await provisionGuild(guild);
});

client.on(Events.GuildDelete, async (guild) => {
  console.log(`[bot] removed from ${guild.id}`);
  await setInstalled(guild.id, false).catch(() => undefined);
});

client.on(Events.GuildMemberRemove, async (member) => {
  await handleMemberLeft(member.guild, member.id).catch((e) => console.error('[roster] leave', e));
});

client.on(Events.InteractionCreate, async (i: Interaction) => {
  if (!i.inCachedGuild()) return;
  try {
    if (i.isChatInputCommand()) {
      if (i.commandName === 'apply') return await startApplication(i);
      if (i.commandName === 'profile') return await handleProfile(i);
      if (i.commandName === 'roster') return await handleRoster(i);
    } else if (i.isAutocomplete()) {
      return await handleClassAutocomplete(i);
    } else if (i.isButton()) {
      if (i.customId === ACCEPT_RULES_ID) return await handleAcceptRules(i);
      if (i.customId === APPLY_ID) return await startApplication(i);
      if (i.customId.startsWith(APPROVE_PREFIX)) return await handleReview(i, true);
      if (i.customId.startsWith(REJECT_PREFIX)) return await handleReview(i, false);
    } else if (i.isStringSelectMenu()) {
      if (i.customId === APPLY_CLASS_ID) return await handleClassPicked(i);
    } else if (i.isModalSubmit()) {
      if (i.customId.startsWith(APPLY_FORM_PREFIX)) return await handleApplicationSubmit(i);
    }
  } catch (err) {
    console.error('[interaction]', err);
    if (i.isRepliable() && !i.replied && !i.deferred) {
      await i.reply({ content: 'Something went wrong. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => undefined);
    }
  }
});

// The dashboard publishes here whenever someone saves a server's config.
const sub = new Redis(env.redisUrl);
sub.subscribe(CONFIG_CHANGED_CHANNEL).catch((e) => console.error('[redis] subscribe failed', e));
sub.on('message', (_channel, raw) => {
  try {
    const { guildId } = JSON.parse(raw) as ConfigChangedMessage;
    const guild = client.guilds.cache.get(guildId);
    if (guild) void provisionGuild(guild);
  } catch (e) {
    console.error('[redis] bad message', raw, e);
  }
});

async function shutdown() {
  console.log('[bot] shutting down');
  await client.destroy();
  sub.disconnect();
  await pool.end();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await client.login(env.botToken);
