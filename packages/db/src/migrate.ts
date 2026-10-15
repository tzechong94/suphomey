import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');

if (!process.env.DATABASE_URL && !process.env.PGHOST) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');

// Falls back to PG* variables when DATABASE_URL is unset (see client.ts).
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || undefined });
await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
await pool.end();
console.log('Migrations applied');
