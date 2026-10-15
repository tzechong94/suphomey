import { createDb, databaseConfigured } from '@suphomey/db';
import { loadSeed } from '../load';
import { readSeed, type SeedFiles } from '../seed-files';

if (!databaseConfigured()) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');

const names: (keyof SeedFiles)[] = ['blocks', 'summaries', 'amenities', 'blockAmenities', 'landUse', 'programmes', 'riskAreas', 'townStats', 'resale', 'rentals'];
const seed = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await readSeed(n)]))) as SeedFiles;

const { db, pool } = createDb(process.env.DATABASE_URL || undefined);
const start = Date.now();
try {
  await loadSeed(db, seed);
} catch (err) {
  // Drizzle wraps the driver error and its message includes the whole (huge) statement.
  const cause = (err as { cause?: { message?: string; detail?: string } }).cause;
  console.error(`Seed failed: ${cause?.message ?? String(err)}${cause?.detail ? ` (${cause.detail})` : ''}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
if (process.exitCode) process.exit();
console.log(`Seeded ${seed.blocks.length} blocks, ${seed.resale.length} resales, ${seed.rentals.length} rentals in ${((Date.now() - start) / 1000).toFixed(0)}s`);
