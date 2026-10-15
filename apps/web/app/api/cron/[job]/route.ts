import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@suphomey/db';
import { fetchDataset, REFRESH_JOBS, runRefresh, type RefreshJob } from '@suphomey/ingest';
import { CACHE, handler, HttpError, json, notFound } from '@/lib/http';

// Hobby plan maximum. The heaviest job (resale, ~24 MB CSV) takes about 5 s.
export const maxDuration = 300;

/** Constant-time comparison, so response timing does not reveal how much of the secret matched. */
function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Runs one daily refresh job. Called by Vercel Cron, which sends "Authorization: Bearer $CRON_SECRET". */
export const GET = handler(async (request: Request, ctx: RouteContext<'/api/cron/[job]'>) => {
  if (!authorised(request.headers.get('authorization'))) throw new HttpError(401, 'Unauthorised');
  const { job } = await ctx.params;
  if (!(REFRESH_JOBS as readonly string[]).includes(job)) throw notFound('Job');
  const result = await runRefresh(getDb(), job as RefreshJob, fetchDataset);
  return json({ job, ...result }, CACHE.none);
});
