import { createDb, databaseConfigured } from '@suphomey/db';
import { fetchDataset } from '../download';
import { REFRESH_JOBS, runRefresh, type RefreshJob } from '../refresh';

// Usage: pnpm ingest [job ...]   (no jobs = all). Same code path as the cron endpoint.
if (!databaseConfigured()) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
const requested = process.argv.slice(2);
const bad = requested.filter((j) => !(REFRESH_JOBS as readonly string[]).includes(j));
if (bad.length) throw new Error(`Unknown job(s): ${bad.join(', ')}. Jobs: ${REFRESH_JOBS.join(', ')}`);

const { db, pool } = createDb(process.env.DATABASE_URL || undefined);
let failed = false;
for (const job of (requested.length ? requested : REFRESH_JOBS) as RefreshJob[]) {
  const start = Date.now();
  try {
    const result = await runRefresh(db, job, fetchDataset);
    console.log(`${job}: ${result.message} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  } catch (err) {
    failed = true;
    console.error(`${job}: FAILED ${String(err)}`);
  }
}
await pool.end();
process.exit(failed ? 1 : 0);
