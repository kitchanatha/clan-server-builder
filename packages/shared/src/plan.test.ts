import { describe, expect, it } from 'vitest';
import { buildPlan, classList, fillTemplate, formatNickname, normalizeFeatures, rolesForAccess, slug } from './plan.js';
import { botPermissionBits, defaultConfig, guildConfigSchema, parseConfig } from './config.js';
import { TEMPLATES } from './catalog.js';
import { t } from './i18n.js';

describe('normalizeFeatures', () => {
  it('always includes base and drops unknown or unavailable features', () => {
    expect(normalizeFeatures(['roster', 'dkp', 'nope', 'roster'])).toEqual(['base', 'roster']);
  });
});

describe('buildPlan', () => {
  it('base only: everything is public, no guest role', () => {
    const plan = buildPlan({ game: 'any', features: [] });
    expect(plan.roles.map((r) => r.key)).toEqual(['leader', 'officer', 'member']);
    const general = plan.channels.find((c) => c.key === 'general')!;
    expect(general.access).toBe('public');
    expect(rolesForAccess(general.access, plan)).toBeNull();
    expect(plan.channels.some((c) => c.key === 'apply')).toBe(false);
  });

  it('full phase 1: gates chat behind registration and guild channels behind membership', () => {
    const plan = buildPlan({ game: 'aion2', features: ['welcome', 'recruit', 'roster'] });
    expect(plan.roles.map((r) => r.key)).toEqual(['leader', 'officer', 'member', 'guest']);
    const byKey = Object.fromEntries(plan.channels.map((c) => [c.key, c]));
    expect(byKey.welcome.access).toBe('public');
    expect(byKey.general.access).toBe('verified');
    expect(byKey['guild-chat'].access).toBe('guild');
    expect(byKey.roster.readonly).toBe(true);
    expect(byKey.applications.access).toBe('staff');
    expect(rolesForAccess('verified', plan)).toEqual(['guest', 'member', 'officer', 'leader']);
    expect(rolesForAccess('staff', plan)).toEqual(['officer', 'leader']);
  });

  it('every channel belongs to a planned category, and keys are unique', () => {
    for (const tpl of TEMPLATES) {
      const plan = buildPlan({ game: 'rotnw', features: tpl.features, member: { classRoles: true, pingRoles: ['Raid Alerts'] } });
      const cats = new Set(plan.categories.map((c) => c.key));
      for (const ch of plan.channels) expect(cats.has(ch.category)).toBe(true);
      const keys = plan.channels.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
      const roleKeys = plan.roles.map((r) => r.key);
      expect(new Set(roleKeys).size).toBe(roleKeys.length);
    }
  });

  it('member management: arrivals, pick-roles, custom ranks, class and ping roles', () => {
    const plan = buildPlan({
      game: 'aion2',
      features: ['welcome', 'goodbye', 'roles'],
      ranks: { leader: 'Guild Master', officer: 'Elite', member: 'Member', guest: 'Rookie' },
      classes: ['Gladiator', 'Cleric', 'gladiator'],
      member: { classRoles: true, pingRoles: ['Raid Alerts', 'แจ้งเตือนวอร์'] },
    });
    const names = plan.roles.map((r) => `${r.kind}:${r.name}`);
    expect(names).toEqual([
      'rank:Guild Master',
      'rank:Elite',
      'rank:Member',
      'rank:Rookie',
      'class:Gladiator',
      'class:Cleric',
      'ping:Raid Alerts',
      'ping:แจ้งเตือนวอร์',
    ]);
    const byKey = Object.fromEntries(plan.channels.map((c) => [c.key, c]));
    expect(byKey.arrivals.access).toBe('public');
    expect(byKey['pick-roles'].access).toBe('verified');
  });

  it('goodbye alone still gets an arrivals channel; no class roles without the toggle', () => {
    const plan = buildPlan({ game: 'any', features: ['goodbye', 'roles'], member: { classRoles: false, pingRoles: [] } });
    expect(plan.channels.some((c) => c.key === 'arrivals')).toBe(true);
    expect(plan.roles.some((r) => r.kind === 'class')).toBe(false);
  });
});

describe('helpers', () => {
  it('classList falls back to the game preset', () => {
    expect(classList('rotnw')).toContain('Mage');
    expect(classList('rotnw', [' Lord Knight ', ''])).toEqual(['Lord Knight']);
  });

  it('slug keeps Thai letters', () => {
    expect(slug('Raid Alerts!')).toBe('raid-alerts');
    expect(slug('แจ้งเตือน วอร์')).toBe('แจ้งเตือน-วอร์');
  });

  it('formats nicknames and trims to 32 characters', () => {
    expect(formatNickname('[{class}] {ign}', 'Boom', 'Cleric')).toBe('[Cleric] Boom');
    expect(formatNickname('[{class}] {ign}', 'Boom', '')).toBe('Boom');
    expect(formatNickname('{ign} | {class}', 'Boom', '')).toBe('Boom');
    expect(formatNickname('no placeholder', 'Boom', 'X')).toBe('Boom');
    expect([...formatNickname('{ign}', 'ก'.repeat(40), '')].length).toBe(32);
  });

  it('fills templates and leaves unknown placeholders', () => {
    expect(fillTemplate('Hi {user} #{count} {nope}', { user: 'A', count: 3 })).toBe('Hi A #3 {nope}');
  });
});

describe('config', () => {
  it('validates a dashboard payload and fills defaults', () => {
    const ok = guildConfigSchema.safeParse({ game: 'aion2', lang: 'th', features: ['base', 'roster'], rules: 'a' });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.ranks.leader).toBe('Leader');
      expect(ok.data.member.nicknameFormat).toBe('{ign}');
      expect(ok.data.member.pingRoles.length).toBeGreaterThan(0);
    }
    expect(guildConfigSchema.safeParse({ game: 'wow', lang: 'th', features: [] }).success).toBe(false);
    expect(
      guildConfigSchema.safeParse({ game: 'any', lang: 'en', features: [], member: { nicknameFormat: 'nope' } }).success,
    ).toBe(false);
  });

  it('parseConfig upgrades old saved configs and survives garbage', () => {
    const old = parseConfig({ game: 'rotnw', lang: 'en', features: ['base', 'welcome', 'dkp'], rules: 'x' });
    expect(old.game).toBe('rotnw');
    expect(old.features).toEqual(['base', 'welcome']);
    expect(old.ranks.guest).toBe('Guest');
    const broken = parseConfig({ game: 'rotnw', ranks: { leader: '' }, features: 'nope' });
    expect(broken.game).toBe('rotnw');
    expect(broken.ranks.leader).toBe('Leader');
    expect(parseConfig(null).features).toEqual(defaultConfig().features);
  });

  it('asks for a fixed permission set without Administrator, including nicknames', () => {
    const bits = BigInt(botPermissionBits());
    expect(bits & 8n).toBe(0n);
    expect(bits & (1n << 28n)).not.toBe(0n);
    expect(bits & (1n << 27n)).not.toBe(0n);
  });
});

describe('i18n', () => {
  it('fills placeholders', () => {
    expect(t('en', 'welcomeTitle', { guild: 'Night Owls' })).toBe('Welcome to Night Owls');
  });
});
