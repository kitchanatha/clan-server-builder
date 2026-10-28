function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in.`);
  return v;
}

export const env = {
  clientId: required('DISCORD_CLIENT_ID'),
  clientSecret: required('DISCORD_CLIENT_SECRET'),
  redirectUri: required('DISCORD_REDIRECT_URI'),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  port: Number(process.env.API_PORT ?? 3001),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  sessionSecret: required('SESSION_SECRET'),
  secureCookies: (process.env.WEB_ORIGIN ?? '').startsWith('https://'),
};
