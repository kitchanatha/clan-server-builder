import { REST, Routes, SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { env } from './env.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('apply')
    .setDescription('Apply to join the guild')
    .setDescriptionLocalizations({ th: 'สมัครเข้ากิลด์' })
    .setContexts(InteractionContextType.Guild),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Add or update your roster entry')
    .setDescriptionLocalizations({ th: 'เพิ่มหรือแก้ไขข้อมูลของคุณในรายชื่อ' })
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o.setName('ign').setDescription('In-game name').setDescriptionLocalizations({ th: 'ชื่อในเกม' }).setRequired(true).setMaxLength(32),
    )
    .addStringOption((o) =>
      o.setName('class').setDescription('Class / job').setDescriptionLocalizations({ th: 'อาชีพ' }).setRequired(true).setAutocomplete(true),
    )
    .addStringOption((o) =>
      o.setName('power').setDescription('Combat power').setDescriptionLocalizations({ th: 'พลังรบ' }).setRequired(true).setMaxLength(14),
    )
    .addStringOption((o) =>
      o.setName('playtime').setDescription('When you usually play').setDescriptionLocalizations({ th: 'ช่วงเวลาที่เล่น' }).setMaxLength(100),
    ),

  new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Guild roster')
    .setDescriptionLocalizations({ th: 'รายชื่อสมาชิกกิลด์' })
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName('view')
        .setDescription('Show the roster')
        .setDescriptionLocalizations({ th: 'ดูรายชื่อ' })
        .addStringOption((o) => o.setName('class').setDescription('Only this class').setAutocomplete(true)),
    )
    .addSubcommand((s) =>
      s.setName('export').setDescription('Download the roster as CSV (staff)').setDescriptionLocalizations({ th: 'ส่งออกเป็น CSV (ทีมงาน)' }),
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove someone from the roster (staff)')
        .setDescriptionLocalizations({ th: 'ลบออกจากรายชื่อ (ทีมงาน)' })
        .addUserOption((o) => o.setName('user').setDescription('Member to remove').setRequired(true)),
    ),
].map((c) => c.toJSON());

/** Register slash commands: instantly to DEV_GUILD_ID if set, otherwise globally. */
export async function registerCommands(): Promise<void> {
  const rest = new REST().setToken(env.botToken);
  const route = env.devGuildId
    ? Routes.applicationGuildCommands(env.clientId, env.devGuildId)
    : Routes.applicationCommands(env.clientId);
  await rest.put(route, { body: commands });
  console.log(`[commands] registered ${commands.length} ${env.devGuildId ? 'dev-guild' : 'global'} commands`);
}
