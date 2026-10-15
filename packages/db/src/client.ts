import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';
import * as schema from './schema';

// Driver-agnostic handle: the app uses node-postgres, tests use in-memory PGlite.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * With no connection string, node-postgres reads the standard PGHOST, PGUSER,
 * PGPASSWORD, PGDATABASE, PGPORT and PGSSLMODE variables. On AWS, ECS injects those
 * from the Secrets Manager secret that RDS generates (see infra/).
 */
export function createDb(connectionString?: string) {
  // Serverless instances are short-lived and Neon's pooler (PgBouncer) does the real
  // pooling, so each instance keeps only a few connections and drops idle ones quickly.
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
  return { db: drizzle(pool, { schema }) as Db, pool };
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.PGHOST);
}

let shared: Db | undefined;

/** One pool per server instance, created on first use from DATABASE_URL (or PG* variables). */
export function getDb(): Db {
  if (!shared) {
    if (!databaseConfigured()) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
    shared = createDb(process.env.DATABASE_URL || undefined).db;
  }
  return shared;
}
