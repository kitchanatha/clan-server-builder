import { z } from 'zod';
import { FEATURES, GAMES, type FeatureId, type GameId, type Lang } from './catalog.js';
import { normalizeFeatures } from './plan.js';

const gameIds = GAMES.map((g) => g.id) as [GameId, ...GameId[]];
const featureIds = FEATURES.map((f) => f.id) as [FeatureId, ...FeatureId[]];

const label = z.string().trim().min(1).max(32);

/** What each guild calls its ranks. */
export const ranksSchema = z.object({
  leader: label,
  officer: label,
  member: label,
  guest: label,
});
export type Ranks = z.infer<typeof ranksSchema>;

export const DEFAULT_RANKS: Ranks = { leader: 'Leader', officer: 'Officer', member: 'Member', guest: 'Guest' };

/** Placeholders the nickname format may use. Must contain {ign}. */
export const NICKNAME_FORMATS = ['{ign}', '{ign} | {class}', '[{class}] {ign}', '{ign} ({class})'] as const;

/** Welcome / goodbye / registration / self-role settings. Empty message = built-in text. */
export const memberSettingsSchema = z.object({
  welcomeMessage: z.string().max(500).default(''),
  goodbyeMessage: z.string().max(500).default(''),
  nicknameFormat: z
    .string()
    .trim()
    .max(40)
    .refine((s) => s.includes('{ign}'), 'Nickname format must contain {ign}')
    .default('{ign}'),
  /** Ask for the class when registering. */
  askClass: z.boolean().default(true),
  /** Create one Discord role per class and give it to members. */
  classRoles: z.boolean().default(false),
  /** Opt-in roles members pick for themselves (alerts, playstyle). */
  pingRoles: z.array(label).max(10).default(['Raid Alerts', 'Guild War']),
});
export type MemberSettings = z.infer<typeof memberSettingsSchema>;

/** What the dashboard saves for one Discord server. Older saved configs get defaults filled in. */
export const guildConfigSchema = z.object({
  game: z.enum(gameIds),
  lang: z.enum(['th', 'en']),
  features: z.array(z.enum(featureIds)).max(featureIds.length),
  /** Shown in #rules; one rule per line. */
  rules: z.string().max(1500).default(''),
  ranks: ranksSchema.default(DEFAULT_RANKS),
  /** The guild's own class list. Empty = use the game preset. */
  classes: z.array(label).max(25).default([]),
  member: memberSettingsSchema.default({}),
});

export type GuildConfig = z.infer<typeof guildConfigSchema>;
/** What the dashboard sends: defaults may be left out. */
export type GuildConfigInputRaw = z.input<typeof guildConfigSchema>;

export const DEFAULT_RULES: Record<Lang, string> = {
  th: 'เคารพสมาชิกทุกคน\nห้ามสแปมหรือโฆษณา\nห้ามซื้อขายบัญชีในเซิร์ฟนี้\nทำตามคำแนะนำของออฟฟิสเซอร์',
  en: 'Respect every member\nNo spam or advertising\nNo account trading here\nFollow officer instructions',
};

export function defaultConfig(lang: Lang = 'th'): GuildConfig {
  return guildConfigSchema.parse({
    game: 'any',
    lang,
    features: ['base', 'welcome', 'goodbye', 'roles', 'recruit', 'roster'],
    rules: DEFAULT_RULES[lang],
  });
}

/**
 * Read a stored config safely: fills in defaults for settings added later and
 * drops unknown or unavailable features. Never throws.
 */
export function parseConfig(raw: unknown): GuildConfig {
  const parsed = guildConfigSchema.safeParse(raw);
  if (parsed.success) return { ...parsed.data, features: normalizeFeatures(parsed.data.features) };
  // Keep whatever top-level fields are still valid.
  const base = defaultConfig();
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pick = <K extends keyof GuildConfig>(key: K): GuildConfig[K] => {
    const field = guildConfigSchema.shape[key].safeParse(obj[key]);
    return field.success ? (field.data as GuildConfig[K]) : base[key];
  };
  const features = Array.isArray(obj.features) ? normalizeFeatures(obj.features.map(String)) : base.features;
  return {
    game: pick('game'),
    lang: pick('lang'),
    features,
    rules: pick('rules'),
    ranks: pick('ranks'),
    classes: pick('classes'),
    member: pick('member'),
  };
}

/** Pub/sub channel the API publishes on when a guild's config changes. */
export const CONFIG_CHANGED_CHANNEL = 'csb:config-changed';

export interface ConfigChangedMessage {
  guildId: string;
}

/**
 * Permissions the bot asks for on invite. Deliberately not Administrator.
 * Bit values from https://discord.com/developers/docs/topics/permissions
 */
export const BOT_PERMISSIONS = {
  ManageChannels: 1n << 4n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  Connect: 1n << 20n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
} as const;

export function botPermissionBits(): string {
  return Object.values(BOT_PERMISSIONS).reduce((a, b) => a | b, 0n).toString();
}
