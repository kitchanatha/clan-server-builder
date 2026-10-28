import { z } from 'zod';
import { FEATURES, GAMES, type FeatureId, type GameId, type Lang } from './catalog.js';

const gameIds = GAMES.map((g) => g.id) as [GameId, ...GameId[]];
const featureIds = FEATURES.map((f) => f.id) as [FeatureId, ...FeatureId[]];

/** What the dashboard saves for one Discord server. */
export const guildConfigSchema = z.object({
  game: z.enum(gameIds),
  lang: z.enum(['th', 'en']),
  features: z.array(z.enum(featureIds)).max(featureIds.length),
  /** Shown in #rules; one rule per line. */
  rules: z.string().max(1500).default(''),
});

export type GuildConfig = z.infer<typeof guildConfigSchema>;

export const DEFAULT_RULES: Record<Lang, string> = {
  th: 'เคารพสมาชิกทุกคน\nห้ามสแปมหรือโฆษณา\nห้ามซื้อขายบัญชีในเซิร์ฟนี้\nทำตามคำแนะนำของออฟฟิสเซอร์',
  en: 'Respect every member\nNo spam or advertising\nNo account trading here\nFollow officer instructions',
};

export function defaultConfig(lang: Lang = 'th'): GuildConfig {
  return { game: 'any', lang, features: ['base', 'welcome', 'recruit', 'roster'], rules: DEFAULT_RULES[lang] };
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
  ManageRoles: 1n << 28n,
} as const;

export function botPermissionBits(): string {
  return Object.values(BOT_PERMISSIONS).reduce((a, b) => a | b, 0n).toString();
}
