import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export * from './schema.js';
export { schema };
export { and, eq, desc, asc, sql, inArray } from 'drizzle-orm';

export type Db = NodePgDatabase<typeof schema>;

export function createDb(url = process.env.DATABASE_URL): { db: Db; pool: pg.Pool } {
  if (!url) throw new Error('DATABASE_URL is not set');
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return { db: drizzle(pool, { schema }), pool };
}
