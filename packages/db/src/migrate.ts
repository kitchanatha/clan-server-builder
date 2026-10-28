import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { createDb } from './index.js';

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

const { db, pool } = createDb();
await migrate(db, { migrationsFolder });
await pool.end();
console.log('Migrations applied.');
