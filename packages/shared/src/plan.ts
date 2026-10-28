// Turns a guild config (game + chosen features) into the roles, categories and
// channels the bot must create. Pure function: used by the dashboard preview and
// by the bot's provisioner, so what users see is exactly what gets built.

import { FEATURES, type FeatureId, type GameId } from './catalog.js';

export type RoleKey = 'leader' | 'officer' | 'member' | 'guest';

/**
 * Who can see a channel.
 * - public:   everyone, including people who just joined
 * - verified: anyone who accepted the rules (Guest and up); public when verify is off
 * - guild:    Member, Officer, Leader
 * - staff:    Officer, Leader
 */
export type Access = 'public' | 'verified' | 'guild' | 'staff';

export interface PlannedRole {
  key: RoleKey;
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
  features: FeatureId[];
}

const ROLE_DEFS: Record<RoleKey, PlannedRole> = {
  leader: { key: 'leader', name: 'Leader', color: 0xe0a14a, hoist: true },
  officer: { key: 'officer', name: 'Officer', color: 0xd1603d, hoist: true },
  member: { key: 'member', name: 'Member', color: 0x4f8fd6, hoist: true },
  guest: { key: 'guest', name: 'Guest', color: 0x8f9bad, hoist: false },
};

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
  const out = new Set<FeatureId>(['base']);
  for (const f of features) if (allowed.has(f)) out.add(f as FeatureId);
  // Keep catalog order so plans are stable.
  return FEATURES.map((f) => f.id).filter((id) => out.has(id));
}

export function buildPlan(input: GuildConfigInput): ProvisionPlan {
  const features = new Set(normalizeFeatures(input.features));
  const has = (f: FeatureId) => features.has(f);

  // With no gate (no verify, no recruitment), "verified" channels are open to all.
  const gated = has('welcome');
  const verified: Access = gated ? 'verified' : 'public';
  // Without recruitment there is no way to become a Member, so guild channels
  // fall back to the verified audience.
  const guild: Access = has('recruit') ? 'guild' : verified;

  const roleKeys: RoleKey[] = ['leader', 'officer', 'member'];
  if (has('welcome')) roleKeys.push('guest');

  const channels: PlannedChannel[] = [];
  const add = (c: Omit<PlannedChannel, 'readonly'> & { readonly?: boolean }) =>
    channels.push({ readonly: false, ...c });

  // Base layout
  add({ key: 'announcements', name: 'announcements', type: 'text', category: 'info', access: 'public', readonly: true, feature: 'base' });
  add({ key: 'rules', name: 'rules', type: 'text', category: 'info', access: 'public', readonly: true, feature: 'base' });
  if (has('welcome')) {
    add({ key: 'welcome', name: 'welcome', type: 'text', category: 'info', access: 'public', readonly: true, feature: 'welcome', topic: 'Accept the rules to unlock the server' });
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
    roles: roleKeys.map((k) => ROLE_DEFS[k]),
    categories: CATEGORY_ORDER.filter((c) => usedCats.has(c.key)),
    channels,
  };
}

/** Which roles can view a channel with this access level. `null` = everyone. */
export function rolesForAccess(access: Access, plan: ProvisionPlan): RoleKey[] | null {
  const present = new Set(plan.roles.map((r) => r.key));
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
