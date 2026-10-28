import { describe, expect, it } from 'vitest';
import { buildPlan, normalizeFeatures, rolesForAccess } from './plan.js';
import { botPermissionBits, guildConfigSchema } from './config.js';
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

  it('full phase 1: gates chat behind verify and guild channels behind membership', () => {
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
    const plan = buildPlan({ game: 'rotnw', features: ['welcome', 'recruit', 'roster'] });
    const cats = new Set(plan.categories.map((c) => c.key));
    for (const ch of plan.channels) expect(cats.has(ch.category)).toBe(true);
    const keys = plan.channels.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('config', () => {
  it('validates a dashboard payload', () => {
    const ok = guildConfigSchema.safeParse({ game: 'aion2', lang: 'th', features: ['base', 'roster'], rules: 'a' });
    expect(ok.success).toBe(true);
    const bad = guildConfigSchema.safeParse({ game: 'wow', lang: 'th', features: [] });
    expect(bad.success).toBe(false);
  });

  it('asks for a fixed permission set without Administrator', () => {
    const bits = BigInt(botPermissionBits());
    expect(bits & 8n).toBe(0n);
    expect(bits & (1n << 28n)).not.toBe(0n);
  });
});

describe('i18n', () => {
  it('fills placeholders', () => {
    expect(t('en', 'welcomeTitle', { guild: 'Night Owls' })).toBe('Welcome to Night Owls');
  });
});
