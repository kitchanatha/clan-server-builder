function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}

export const env = {
  botToken: required('DISCORD_BOT_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  devGuildId: process.env.DEV_GUILD_ID || undefined,
};
