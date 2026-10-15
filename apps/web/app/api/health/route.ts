import { getDataFreshness, getDb, getLatestRuns } from '@suphomey/db';
import { CACHE, handler, json } from '@/lib/http';

/** Database reachable, how fresh the data is, and the last run of each refresh job. */
export const GET = handler(async () => {
  const db = getDb();
  const [freshness, runs] = await Promise.all([getDataFreshness(db), getLatestRuns(db)]);
  return json({ ok: true, ...freshness, jobs: runs }, CACHE.none);
});
