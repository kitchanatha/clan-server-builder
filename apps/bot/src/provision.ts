// Builds or updates a server from its saved config. Safe to run many times:
// existing roles/channels are found through the resource map (or by name) and
// reused, never duplicated. Turning a feature off never deletes channels.

import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type GuildBasedChannel,
  type OverwriteResolvable,
  type Role,
} from 'discord.js';
import { buildPlan, rolesForAccess, type PlannedChannel, type ProvisionPlan } from '@csb/shared';
import { getConfig, loadResources, setProvisionStatus, setResource } from './store.js';
import { categoryKey, channelKey, roleKey } from './util.js';
import { postRules } from './modules/base.js';
import { postWelcomePanel } from './modules/welcome.js';
import { postApplyPanel } from './modules/recruit.js';
import { refreshRoster } from './modules/roster.js';
import { postPickRolesPanel } from './modules/roles.js';

const REASON = 'Clan Server Builder setup';

const running = new Set<string>();
const rerun = new Set<string>();

/** Provision a guild, coalescing calls that arrive while a run is in progress. */
export async function provisionGuild(guild: Guild): Promise<void> {
  if (running.has(guild.id)) {
    rerun.add(guild.id);
    return;
  }
  running.add(guild.id);
  try {
    do {
      rerun.delete(guild.id);
      await runOnce(guild);
    } while (rerun.has(guild.id));
  } finally {
    running.delete(guild.id);
  }
}

async function runOnce(guild: Guild): Promise<void> {
  const config = await getConfig(guild.id);
  if (!config) return;
  await setProvisionStatus(guild.id, 'running');
  try {
    const plan = buildPlan(config);
    const res = await loadResources(guild.id);
    await guild.roles.fetch();
    await guild.channels.fetch();

    const roleIds = await ensureRoles(guild, plan, res);
    const categoryIds = await ensureCategories(guild, plan, res);
    for (const ch of plan.channels) {
      await ensureChannel(guild, ch, plan, roleIds, categoryIds, res);
    }

    // Give the server owner the Leader role so they show as staff.
    const owner = await guild.fetchOwner().catch(() => null);
    if (owner && roleIds.leader && !owner.roles.cache.has(roleIds.leader)) {
      await owner.roles.add(roleIds.leader, REASON).catch(() => undefined);
    }

    await postRules(guild, config);
    if (config.features.includes('welcome')) await postWelcomePanel(guild, config);
    if (config.features.includes('roles')) await postPickRolesPanel(guild, config);
    if (config.features.includes('recruit')) await postApplyPanel(guild, config);
    if (config.features.includes('roster')) await refreshRoster(guild);

    await setProvisionStatus(guild.id, 'done');
    console.log(`[provision] ${guild.name} (${guild.id}) done`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[provision] ${guild.name} (${guild.id}) failed:`, err);
    await setProvisionStatus(guild.id, 'error', friendlyError(message));
  }
}

function friendlyError(message: string): string {
  if (/Missing Permissions/i.test(message)) {
    return 'The bot is missing permissions. Make sure its role has Manage Roles and Manage Channels, and is near the top of the role list.';
  }
  if (/Missing Access/i.test(message)) return 'The bot cannot see a channel it needs. Check its role permissions.';
  return message;
}

type RoleIds = Record<string, string>;

async function ensureRoles(guild: Guild, plan: ProvisionPlan, res: Map<string, string>): Promise<RoleIds> {
  const ids: RoleIds = {};
  for (const r of plan.roles) {
    const key = roleKey(r.key);
    let role: Role | undefined = res.get(key) ? guild.roles.cache.get(res.get(key)!) : undefined;
    role ??= guild.roles.cache.find((x) => x.name === r.name && !x.managed);
    if (!role) {
      role = await guild.roles.create({ name: r.name, color: r.color, hoist: r.hoist, mentionable: false, reason: REASON });
    } else if (role.name !== r.name && !role.managed && guild.members.me && guild.members.me.roles.highest.comparePositionTo(role) > 0) {
      // The dashboard owns names of roles it manages (e.g. a guild renamed "Officer" to "Elite").
      await role.setName(r.name, REASON).catch(() => undefined);
    }
    if (res.get(key) !== role.id) await setResource(guild.id, key, role.id);
    ids[r.key] = role.id;
  }
  return ids;
}

async function ensureCategories(guild: Guild, plan: ProvisionPlan, res: Map<string, string>) {
  const ids: Record<string, string> = {};
  for (const c of plan.categories) {
    const key = categoryKey(c.key);
    let cat = findChannel(guild, res.get(key), ChannelType.GuildCategory) as CategoryChannel | undefined;
    cat ??= guild.channels.cache.find(
      (x): x is CategoryChannel => x.type === ChannelType.GuildCategory && x.name.toUpperCase() === c.name,
    );
    cat ??= await guild.channels.create({ name: c.name, type: ChannelType.GuildCategory, reason: REASON });
    if (res.get(key) !== cat.id) await setResource(guild.id, key, cat.id);
    ids[c.key] = cat.id;
  }
  return ids;
}

async function ensureChannel(
  guild: Guild,
  ch: PlannedChannel,
  plan: ProvisionPlan,
  roleIds: RoleIds,
  categoryIds: Record<string, string>,
  res: Map<string, string>,
) {
  const key = channelKey(ch.key);
  const type = ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
  const overwrites = buildOverwrites(guild, ch, plan, roleIds);
  const parent = categoryIds[ch.category];

  let channel = findChannel(guild, res.get(key), type);
  channel ??= guild.channels.cache.find((x) => x.type === type && x.name === ch.name && x.parentId === parent);

  if (!channel) {
    channel = await guild.channels.create({
      name: ch.name,
      type,
      parent,
      topic: ch.type === 'text' ? ch.topic : undefined,
      permissionOverwrites: overwrites,
      reason: REASON,
    });
  } else if ('permissionOverwrites' in channel) {
    // Keep the admin's names and placement; the dashboard owns who can see what.
    await channel.permissionOverwrites.set(overwrites, REASON);
  }
  if (res.get(key) !== channel.id) await setResource(guild.id, key, channel.id);
}

function findChannel(guild: Guild, id: string | undefined, type: ChannelType): GuildBasedChannel | undefined {
  if (!id) return undefined;
  const ch = guild.channels.cache.get(id);
  return ch && ch.type === type ? ch : undefined;
}

export function buildOverwrites(
  guild: Guild,
  ch: PlannedChannel,
  plan: ProvisionPlan,
  roleIds: RoleIds,
): OverwriteResolvable[] {
  const { ViewChannel, SendMessages, Connect, EmbedLinks, AttachFiles, ReadMessageHistory, CreatePublicThreads } =
    PermissionFlagsBits;
  const view = ch.type === 'voice' ? [ViewChannel, Connect] : [ViewChannel];
  const staff = (['officer', 'leader'] as const).map((k) => roleIds[k]).filter((x): x is string => !!x);
  const out: OverwriteResolvable[] = [];

  // The bot itself must always see and post.
  const me = guild.members.me;
  if (me) out.push({ id: me.id, allow: [ViewChannel, SendMessages, EmbedLinks, AttachFiles, ReadMessageHistory, Connect] });

  const viewers = rolesForAccess(ch.access, plan);
  const everyoneDeny: bigint[] = [];
  if (viewers !== null) everyoneDeny.push(ViewChannel);
  if (ch.readonly) everyoneDeny.push(SendMessages, CreatePublicThreads);
  if (everyoneDeny.length) out.push({ id: guild.roles.everyone.id, deny: everyoneDeny });

  const allowByRole = new Map<string, bigint[]>();
  for (const key of viewers ?? []) {
    const id = roleIds[key];
    if (id) allowByRole.set(id, [...view]);
  }
  if (ch.readonly) {
    for (const id of staff) allowByRole.set(id, [...(allowByRole.get(id) ?? view), SendMessages]);
  }
  for (const [id, allow] of allowByRole) out.push({ id, allow });
  return out;
}
