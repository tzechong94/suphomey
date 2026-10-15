import { sgDate } from '@suphomey/core';
import { refreshPriceSummary, schema, type Db } from '@suphomey/db';
import { eq, gte, sql } from 'drizzle-orm';
import { parseCsv } from './csv';
import type { DatasetKey } from './datasets';
import type { FeatureCollection } from './geojson';
import { insertBatched } from './load';
import { parseHawkers, parsePreschools } from './parse/amenities';
import { parseRiskAreas } from './parse/areas';
import { parseRentals, parseResale, type RentalRecord, type ResaleRecord } from './parse/transactions';

/**
 * Daily refresh jobs, run by Vercel Cron (or EventBridge on AWS, or `pnpm ingest <job>`).
 * Each is idempotent and small enough for a 300 s serverless function. Heavy,
 * slow-changing inputs (block locations, Master Plan, distances) are not
 * refreshed here; see build-seed.
 */
export const REFRESH_JOBS = ['resale', 'rentals', 'preschools', 'hawkers', 'dengue'] as const;
export type RefreshJob = (typeof REFRESH_JOBS)[number];

export type Fetcher = (key: DatasetKey) => Promise<Buffer>;
export type RefreshResult = { rows: number; message: string };

/** Late registrations land in recent months, so each refresh reloads this many months. */
export const RELOAD_MONTHS = 3;

const text = async (fetch: Fetcher, key: DatasetKey) => (await fetch(key)).toString('utf8');
const geo = async (fetch: Fetcher, key: DatasetKey) => JSON.parse(await text(fetch, key)) as FeatureCollection;

export async function runRefresh(db: Db, job: RefreshJob, fetch: Fetcher): Promise<RefreshResult> {
  const [run] = await db.insert(schema.ingestionRuns).values({ dataset: job, status: 'running' }).returning();
  try {
    const result = await JOBS[job](db, fetch);
    await db
      .update(schema.ingestionRuns)
      .set({ status: 'ok', rows: result.rows, message: result.message, finishedAt: new Date() })
      .where(eq(schema.ingestionRuns.id, run!.id));
    return result;
  } catch (err) {
    await db
      .update(schema.ingestionRuns)
      .set({ status: 'failed', message: String(err).slice(0, 1000), finishedAt: new Date() })
      .where(eq(schema.ingestionRuns.id, run!.id));
    throw err;
  }
}

const JOBS: Record<RefreshJob, (db: Db, fetch: Fetcher) => Promise<RefreshResult>> = {
  resale: async (db, fetch) => {
    const parsed = parseResale(parseCsv(await text(fetch, 'resale')));
    return reloadTransactions(db, 'resale', parsed.records, parsed.rejected.length);
  },
  rentals: async (db, fetch) => {
    const parsed = parseRentals(parseCsv(await text(fetch, 'rentals')));
    return reloadTransactions(db, 'rent', parsed.records, parsed.rejected.length);
  },
  preschools: async (db, fetch) => {
    const centres = parseCsv(await text(fetch, 'preschoolCentres'));
    // Only details are updated here, so every centre needs "a" location to be parsed, not a real one
    // (centres placed by postal code at seed time would otherwise be skipped).
    const { amenities } = parsePreschools(centres, await geo(fetch, 'preschoolLocations'), () => ({ lat: 0, lng: 0 }), sgDate().slice(0, 7));
    const updated = await updateDetails(db, 'preschool', amenities);
    return { rows: updated, message: `Updated vacancies for ${updated} of ${amenities.length} centres (new centres appear after the next seed build)` };
  },
  hawkers: async (db, fetch) => {
    const hawkers = parseHawkers(parseCsv(await text(fetch, 'hawkerClosures')));
    const updated = await updateDetails(db, 'hawker', hawkers);
    return { rows: updated, message: `Updated closures for ${updated} of ${hawkers.length} hawker centres` };
  },
  dengue: async (db, fetch) => {
    const areas = parseRiskAreas(await geo(fetch, 'dengueClusters'), await geo(fetch, 'aedesAreas'));
    await db.transaction(async (tx) => {
      await tx.delete(schema.riskAreas);
      if (areas.length) await tx.insert(schema.riskAreas).values(areas);
    });
    return { rows: areas.length, message: `${areas.filter((a) => a.kind === 'dengue').length} dengue clusters, ${areas.filter((a) => a.kind === 'aedes').length} high-Aedes areas` };
  },
};

/** "YYYY-MM-01" minus n months. */
export function monthsBefore(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return d.toISOString().slice(0, 10);
}

async function reloadTransactions(
  db: Db,
  kind: 'resale' | 'rent',
  records: (ResaleRecord | RentalRecord)[],
  rejected: number,
): Promise<RefreshResult> {
  const table = kind === 'resale' ? schema.resaleTransactions : schema.rentalTransactions;
  const [{ latest } = { latest: null }] = await db.select({ latest: sql<string | null>`max(${table.month})::text` }).from(table);
  // Reload from three months before the latest month we already have (or everything, on an empty table;
  // note Postgres has no year 0, so the "everything" bound must be a real date).
  const from = latest ? monthsBefore(latest, RELOAD_MONTHS - 1) : '1900-01-01';
  const fresh = records.filter((r) => r.month >= from);

  let created = 0;
  await db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    const ids = new Map((await t.select({ id: schema.blocks.id, key: schema.blocks.key }).from(schema.blocks)).map((b) => [b.key, b.id]));
    // A block we have never seen (e.g. a newly sold-out estate) is added without a location;
    // it gets one at the next seed build.
    const unknown = [...new Map(fresh.filter((r) => !ids.has(r.key)).map((r) => [r.key, r])).values()];
    if (unknown.length) {
      const inserted = await t
        .insert(schema.blocks)
        .values(unknown.map((r) => ({ key: r.key, block: r.key.split('|')[0]!, street: r.key.split('|')[1]!, town: r.town })))
        .returning({ id: schema.blocks.id, key: schema.blocks.key });
      await t.insert(schema.blockSummary).values(inserted.map((b) => ({ blockId: b.id })));
      for (const b of inserted) ids.set(b.key, b.id);
      created = inserted.length;
    }
    await t.delete(table).where(gte(table.month, from));
    if (kind === 'resale') {
      await insertBatched(
        t,
        schema.resaleTransactions,
        (fresh as ResaleRecord[]).map(({ key, town: _town, ...r }) => ({ blockId: ids.get(key)!, ...r })),
      );
    } else {
      await insertBatched(
        t,
        schema.rentalTransactions,
        (fresh as RentalRecord[]).map(({ key, month, flatType, rent }) => ({ blockId: ids.get(key)!, month, flatType, rent })),
      );
    }
    await refreshPriceSummary(t);
  });
  const parts = [`Reloaded ${fresh.length} ${kind === 'resale' ? 'resales' : 'rentals'} from ${from.slice(0, 7)}`];
  if (created) parts.push(`${created} new blocks (no location until next seed build)`);
  if (rejected) parts.push(`${rejected} rows rejected`);
  return { rows: fresh.length, message: parts.join('; ') };
}

/**
 * Replaces `details` on places we already know (matched by kind and source id),
 * in one UPDATE ... FROM (VALUES ...) statement: one round trip instead of one per
 * place, which matters against a remote database. New places are not inserted
 * here because their distances to blocks are computed by the seed build.
 */
async function updateDetails(db: Db, kind: string, places: { sourceId: string; details: Record<string, unknown> }[]): Promise<number> {
  if (places.length === 0) return 0;
  const values = sql.join(
    places.map((p) => sql`(${p.sourceId}, ${JSON.stringify(p.details)}::jsonb)`),
    sql`, `,
  );
  const result = await db.execute(sql`
    UPDATE amenities AS a SET details = v.details
    FROM (VALUES ${values}) AS v(source_id, details)
    WHERE a.kind = ${kind} AND a.source_id = v.source_id
    RETURNING a.id`);
  return (result as unknown as { rows: unknown[] }).rows.length;
}
