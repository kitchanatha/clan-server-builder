import { Redis } from 'ioredis';
import { createDb } from '@csb/db';
import { env } from './env.js';
import { buildServer } from './server.js';

const { db, pool } = createDb(env.databaseUrl);
const redis = new Redis(env.redisUrl);

const app = await buildServer({
  db,
  redis,
  oauth: { clientId: env.clientId, clientSecret: env.clientSecret, redirectUri: env.redirectUri },
  webOrigin: env.webOrigin,
  sessionSecret: env.sessionSecret,
  secureCookies: env.secureCookies,
});

app.addHook('onClose', async () => {
  redis.disconnect();
  await pool.end();
});

await app.listen({ port: env.port, host: '0.0.0.0' });

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => void app.close().then(() => process.exit(0)));
}
