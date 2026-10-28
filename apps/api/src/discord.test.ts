import { describe, expect, it } from 'vitest';
import { authorizeUrl, botInviteUrl, canManage } from './discord.js';

describe('canManage', () => {
  it('allows owners, admins and Manage Server', () => {
    expect(canManage({ owner: true, permissions: '0' })).toBe(true);
    expect(canManage({ owner: false, permissions: String(1n << 3n) })).toBe(true);
    expect(canManage({ owner: false, permissions: String(1n << 5n) })).toBe(true);
    expect(canManage({ owner: false, permissions: String(1n << 11n) })).toBe(false);
  });
});

describe('urls', () => {
  it('locks the invite to one server when given', () => {
    const u = new URL(botInviteUrl('123', '456'));
    expect(u.searchParams.get('guild_id')).toBe('456');
    expect(u.searchParams.get('scope')).toBe('bot applications.commands');
    expect(BigInt(u.searchParams.get('permissions')!) & 8n).toBe(0n);
  });

  it('asks only for identify and guilds on login', () => {
    const u = new URL(authorizeUrl({ clientId: '1', clientSecret: 's', redirectUri: 'http://x/cb' }, 'abc'));
    expect(u.searchParams.get('scope')).toBe('identify guilds');
    expect(u.searchParams.get('state')).toBe('abc');
  });
});
