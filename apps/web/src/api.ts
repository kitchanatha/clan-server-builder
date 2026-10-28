import type { GuildConfig } from '@csb/shared';

export interface Me {
  id: string;
  username: string;
  avatar: string | null;
}

export type ProvisionStatus = 'idle' | 'queued' | 'running' | 'done' | 'error';

export interface GuildSummary {
  id: string;
  name: string;
  icon: string | null;
  configured: boolean;
  botInstalled: boolean;
  provisionStatus: ProvisionStatus;
}

export interface GuildDetail extends GuildSummary {
  config: GuildConfig;
  provisionError: string | null;
  provisionedAt: string | null;
  inviteUrl: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const api = {
  me: () => call<Me>('/api/me'),
  guilds: () => call<GuildSummary[]>('/api/guilds'),
  guild: (id: string) => call<GuildDetail>(`/api/guilds/${id}`),
  saveConfig: (id: string, config: GuildConfig) =>
    call<{ ok: true; botInstalled: boolean }>(`/api/guilds/${id}/config`, { method: 'PUT', body: JSON.stringify(config) }),
  resync: (id: string) => call<{ ok: true }>(`/api/guilds/${id}/resync`, { method: 'POST' }),
  logout: () => call<{ ok: true }>('/auth/logout', { method: 'POST' }),
};
