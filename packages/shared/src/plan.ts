// Turns a guild config into the roles, categories and channels the bot must
// create. Pure function: used by the dashboard preview and by the bot's
// provisioner, so what users see is exactly what gets built.

import { FEATURES, getGame, type FeatureId, type GameId } from './catalog.js';
import type { MemberSettings, Ranks } from './config.js';

/** The four ranks every guild has (names are customizable). */
export type RoleKey = 'leader' | 'officer' | 'member' | 'guest';

/**
 * Who can see a channel.
 * - public:   everyone, including people who just joined
 * - verified: anyone who registered (Guest and up); public when registration is off
 * - guild:    Member, Officer, Leader
 * - staff:    Officer, Leader
 */
export type Access = 'public' | 'verified' | 'guild' | 'staff';

export type RoleKind = 'rank' | 'class' | 'ping';

export interface PlannedRole {
  /** Stable key: a RoleKey for ranks, `class:<slug>` or `ping:<slug>` otherwise. */
  key: string;
  kind: RoleKind;
  name: string;
  /** Hex color, e.g. 0xE0A14A */
  color: number;
  /** Shown separately in the member list */
  hoist: boolean;
}

export interface PlannedCategory {
  key: string;
  name: string;
}

export interface PlannedChannel {
  key: string;
  name: string;
  type: 'text' | 'voice';
  category: string;
  access: Access;
  /** Only staff (and the bot) can post. */
  readonly: boolean;
  feature: FeatureId;
  topic?: string;
}

export interface ProvisionPlan {
  roles: PlannedRole[];
  categories: PlannedCategory[];
  channels: PlannedChannel[];
}

export interface GuildConfigInput {
  game: GameId;
  features: readonly string[];
  ranks?: Ranks;
  classes?: readonly string[];
  member?: Pick<MemberSettings, 'classRoles' | 'pingRoles'>;
}

const RANK_STYLE: Record<RoleKey, { color: number; hoist: boolean; name: string }> = {
  leader: { color: 0xe0a14a, hoist: true, name: 'Leader' },
  officer: { color: 0xd1603d, hoist: true, name: 'Officer' },
  member: { color: 0x4f8fd6, hoist: true, name: 'Member' },
  guest: { color: 0x8f9bad, hoist: false, name: 'Guest' },
};

const CLASS_COLOR = 0x6b8bd6;
const PING_COLOR = 0x9aa6b6;

const CATEGORY_ORDER: PlannedCategory[] = [
  { key: 'info', name: 'INFO' },
  { key: 'recruit', name: 'RECRUITMENT' },
  { key: 'chat', name: 'CHAT' },
  { key: 'guild', name: 'GUILD' },
  { key: 'staff', name: 'STAFF' },
  { key: 'voice', name: 'VOICE' },
];

/** Keep only known, available features, always include base, drop duplicates. */
export function normalizeFeatures(features: readonly string[]): FeatureId[] {
  const allowed = new Set(FEATURES.filter((f) => f.available).map((f) => f.id as string));
  const out = new Set<string>(['base']);
  for (const f of features) if (allowed.has(f)) out.add(f);
  // Keep catalog order so plans are stable.
  return FEATURES.map((f) => f.id).filter((id) => out.has(id));
}

/** The guild's own class list, or the game preset when it has none. */
export function classList(game: GameId, classes?: readonly string[]): string[] {
  const own = (classes ?? []).map((c) => c.trim()).filter(Boolean);
  return own.length ? dedupe(own) : [...getGame(game).classes];
}

/** Stable key part for a role or channel name. Keeps Thai and other letters. */
export function slug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^\p{L}\p{M}\p{N}-]/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'x'
  );
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = slug(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const classRoleKey = (name: string) => `class:${slug(name)}`;
export const pingRoleKey = (name: string) => `ping:${slug(name)}`;

export function buildPlan(input: GuildConfigInput): ProvisionPlan {
  const features = new Set<string>(normalizeFeatures(input.features));
  const has = (f: FeatureId) => features.has(f);

  // Registration (welcome) is the gate: without it, "verified" channels are open to all.
  const verified: Access = has('welcome') ? 'verified' : 'public';
  // Without recruitment there is no way to become a Member, so guild channels
  // fall back to the verified audience. (/rank can still promote by hand.)
  const guild: Access = has('recruit') ? 'guild' : verified;

  // ---- roles ----
  const ranks = input.ranks;
  const rank = (k: RoleKey): PlannedRole => ({
    key: k,
    kind: 'rank',
    name: ranks?.[k] ?? RANK_STYLE[k].name,
    color: RANK_STYLE[k].color,
    hoist: RANK_STYLE[k].hoist,
  });
  const roles: PlannedRole[] = [rank('leader'), rank('officer'), rank('member')];
  if (has('welcome')) roles.push(rank('guest'));

  const classRoles = !!input.member?.classRoles && (has('welcome') || has('roles'));
  if (classRoles) {
    for (const c of classList(input.game, input.classes)) {
      roles.push({ key: classRoleKey(c), kind: 'class', name: c, color: CLASS_COLOR, hoist: false });
    }
  }
  if (has('roles')) {
    for (const p of dedupe([...(input.member?.pingRoles ?? [])])) {
      roles.push({ key: pingRoleKey(p), kind: 'ping', name: p, color: PING_COLOR, hoist: false });
    }
  }

  // ---- channels ----
  const channels: PlannedChannel[] = [];
  const add = (c: Omit<PlannedChannel, 'readonly'> & { readonly?: boolean }) =>
    channels.push({ readonly: false, ...c });

  add({ key: 'announcements', name: 'announcements', type: 'text', category: 'info', access: 'public', readonly: true, feature: 'base' });
  add({ key: 'rules', name: 'rules', type: 'text', category: 'info', access: 'public', readonly: true, feature: 'base' });
  if (has('welcome')) {
    add({ key: 'welcome', name: 'welcome', type: 'text', category: 'info', access: 'public', readonly: true, feature: 'welcome', topic: 'Press Register and enter your in-game name' });
  }
  if (has('welcome') || has('goodbye')) {
    add({ key: 'arrivals', name: 'arrivals', type: 'text', category: 'info', access: 'public', readonly: true, feature: has('welcome') ? 'welcome' : 'goodbye', topic: 'Who joined and who left' });
  }
  if (has('roles')) {
    add({ key: 'pick-roles', name: 'pick-roles', type: 'text', category: 'info', access: verified, readonly: true, feature: 'roles', topic: 'Pick your class and alert roles' });
  }
  if (has('recruit')) {
    add({ key: 'apply', name: 'apply-here', type: 'text', category: 'recruit', access: verified, readonly: true, feature: 'recruit', topic: 'Press Apply to join the guild' });
    add({ key: 'applications', name: 'applications', type: 'text', category: 'staff', access: 'staff', feature: 'recruit' });
  }
  add({ key: 'general', name: 'general', type: 'text', category: 'chat', access: verified, feature: 'base' });
  add({ key: 'screenshots', name: 'screenshots', type: 'text', category: 'chat', access: verified, feature: 'base' });
  add({ key: 'guild-chat', name: 'guild-chat', type: 'text', category: 'guild', access: guild, feature: 'base' });
  if (has('roster')) {
    add({ key: 'roster', name: 'roster', type: 'text', category: 'guild', access: guild, readonly: true, feature: 'roster', topic: 'Use /profile to update your entry' });
  }
  add({ key: 'officer-chat', name: 'officer-chat', type: 'text', category: 'staff', access: 'staff', feature: 'base' });
  add({ key: 'lobby', name: 'Lobby', type: 'voice', category: 'voice', access: verified, feature: 'base' });
  add({ key: 'party-1', name: 'Party 1', type: 'voice', category: 'voice', access: guild, feature: 'base' });
  add({ key: 'party-2', name: 'Party 2', type: 'voice', category: 'voice', access: guild, feature: 'base' });

  const usedCats = new Set(channels.map((c) => c.category));
  return {
    roles,
    categories: CATEGORY_ORDER.filter((c) => usedCats.has(c.key)),
    channels,
  };
}

/** Which rank roles can view a channel with this access level. `null` = everyone. */
export function rolesForAccess(access: Access, plan: ProvisionPlan): RoleKey[] | null {
  const present = new Set(plan.roles.filter((r) => r.kind === 'rank').map((r) => r.key));
  const pick = (keys: RoleKey[]) => keys.filter((k) => present.has(k));
  switch (access) {
    case 'public':
      return null;
    case 'verified':
      return pick(['guest', 'member', 'officer', 'leader']);
    case 'guild':
      return pick(['member', 'officer', 'leader']);
    case 'staff':
      return pick(['officer', 'leader']);
  }
}

// ---- text helpers shared by bot and dashboard preview ----

/** Fill {placeholders}. Unknown placeholders are left as they are. */
export function fillTemplate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Discord nicknames are at most 32 characters. */
export function formatNickname(format: string, ign: string, className: string): string {
  const fmt = format.includes('{ign}') ? format : '{ign}';
  let nick = fillTemplate(fmt, { ign: ign.trim(), class: className.trim() })
    // A format with {class} but no class chosen: drop empty brackets and separators.
    .replace(/\[\s*\]|\(\s*\)/g, '')
    .replace(/\s*\|\s*$/, '')
    .replace(/^\s*\|\s*/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!nick) nick = ign.trim();
  return [...nick].slice(0, 32).join('');
}
