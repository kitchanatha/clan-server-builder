// Minimal Discord REST client for the dashboard: OAuth2 login and the user's servers.
import { botPermissionBits } from '@csb/shared';

const API = 'https://discord.com/api/v10';

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface DiscordPartialGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const MANAGE_GUILD = 1n << 5n;
const ADMINISTRATOR = 1n << 3n;

export class DiscordError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function authorizeUrl(cfg: OAuthConfig, state: string): string {
  const p = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    state,
    prompt: 'none',
  });
  return `https://discord.com/oauth2/authorize?${p}`;
}

/** Invite link for the bot, pre-selecting the server and the exact permissions it needs. */
export function botInviteUrl(clientId: string, guildId?: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    scope: 'bot applications.commands',
    permissions: botPermissionBits(),
  });
  if (guildId) {
    p.set('guild_id', guildId);
    p.set('disable_guild_select', 'true');
  }
  return `https://discord.com/oauth2/authorize?${p}`;
}

/** A user can set up a server they own, administer, or can manage. */
export function canManage(g: Pick<DiscordPartialGuild, 'owner' | 'permissions'>): boolean {
  if (g.owner) return true;
  const perms = BigInt(g.permissions);
  return (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_GUILD) !== 0n;
}

async function tokenRequest(cfg: OAuthConfig, body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...body }),
  });
  if (!res.ok) throw new DiscordError(res.status, `Token request failed: ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(cfg: OAuthConfig, code: string): Promise<TokenResponse> {
  return tokenRequest(cfg, { grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri });
}

export function refreshToken(cfg: OAuthConfig, refresh: string): Promise<TokenResponse> {
  return tokenRequest(cfg, { grant_type: 'refresh_token', refresh_token: refresh });
}

async function userGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new DiscordError(res.status, `GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const getUser = (token: string) => userGet<DiscordUser>(token, '/users/@me');
export const getUserGuilds = (token: string) => userGet<DiscordPartialGuild[]>(token, '/users/@me/guilds');

export function guildIconUrl(g: Pick<DiscordPartialGuild, 'id' | 'icon'>): string | null {
  return g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=96` : null;
}

export function avatarUrl(u: Pick<DiscordUser, 'id' | 'avatar'>): string | null {
  return u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : null;
}
