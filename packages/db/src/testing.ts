import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Db } from './client';
import * as schema from './schema';

/** Fresh in-memory Postgres (PGlite) with the real migrations applied. For tests only. */
export async function createTestDb() {
  const client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  const db = drizzle(client, { schema }) as unknown as Db;
  return { db, close: () => client.close() };
}
