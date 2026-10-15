import { sql } from 'drizzle-orm';
import type { Db } from './client';

/**
 * Queries behind "The Tea" page. Each looks back from the latest month in the
 * data (not today), so a snapshot stays self-consistent.
 */
type Row = Record<string, unknown>;
// Both drivers we use (node-postgres and PGlite) return raw query results as { rows }.
const rows = async <T extends Row>(db: Db, query: ReturnType<typeof sql>) => ((await db.execute(query)) as unknown as { rows: T[] }).rows;

/** Island-wide monthly median rent per flat type. */
export function rentTrend(db: Db) {
  return rows<{ month: string; flat_type: string; median: number; n: number }>(
    db,
    sql`SELECT month::text, flat_type, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY rent))::int AS median, count(*)::int AS n
        FROM rental_transactions
        WHERE flat_type IN ('3-ROOM', '4-ROOM', '5-ROOM')
        GROUP BY month, flat_type ORDER BY month`,
  );
}

/** 4-room median rent per town: last 12 months against the 12 before, with the change. */
export function rentChangeByTown(db: Db) {
  return rows<{ town: string; recent: number; previous: number; change: number; n: number }>(
    db,
    sql`WITH latest AS (SELECT max(month) AS m FROM rental_transactions),
        r AS (
          SELECT b.town,
                 percentile_cont(0.5) WITHIN GROUP (ORDER BY t.rent) FILTER (WHERE t.month > l.m - interval '12 months') AS recent,
                 percentile_cont(0.5) WITHIN GROUP (ORDER BY t.rent) FILTER (WHERE t.month <= l.m - interval '12 months' AND t.month > l.m - interval '24 months') AS previous,
                 count(*) FILTER (WHERE t.month > l.m - interval '12 months') AS n
          FROM rental_transactions t JOIN blocks b ON b.id = t.block_id CROSS JOIN latest l
          WHERE t.flat_type = '4-ROOM'
          GROUP BY b.town
        )
        SELECT town, round(recent)::int AS recent, round(previous)::int AS previous,
               round(((recent - previous) / previous * 100)::numeric, 1)::float AS change, n::int AS n
        FROM r WHERE recent IS NOT NULL AND previous IS NOT NULL AND n >= 30
        ORDER BY change DESC`,
  );
}

/**
 * Lease decay: resale price per square metre by years of lease left at the
 * time of sale (5-year bands), over the last 24 months.
 */
export function leaseDecay(db: Db) {
  return rows<{ lease_left: number; psm: number; n: number }>(
    db,
    sql`WITH latest AS (SELECT max(month) AS m FROM resale_transactions)
        SELECT (floor((99 - (extract(year FROM t.month) - t.lease_start_year)) / 5) * 5)::int AS lease_left,
               round(percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price / t.floor_area_sqm))::int AS psm,
               count(*)::int AS n
        FROM resale_transactions t CROSS JOIN latest l
        WHERE t.month > l.m - interval '24 months'
        GROUP BY 1 HAVING count(*) >= 30 ORDER BY 1`,
  );
}

/** Resale price per square metre by straight-line distance to the nearest MRT/LRT exit, last 24 months. */
export function mrtPremium(db: Db) {
  return rows<{ band: string; psm: number; n: number }>(
    db,
    sql`WITH latest AS (SELECT max(month) AS m FROM resale_transactions),
        banded AS (
          SELECT CASE WHEN s.nearest_mrt_m < 300 THEN '0' WHEN s.nearest_mrt_m < 600 THEN '300' WHEN s.nearest_mrt_m < 1000 THEN '600' ELSE '1000' END AS band,
                 t.price / t.floor_area_sqm AS psm
          FROM resale_transactions t JOIN block_summary s ON s.block_id = t.block_id CROSS JOIN latest l
          WHERE t.month > l.m - interval '24 months' AND s.nearest_mrt_m IS NOT NULL
        )
        SELECT band, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY psm))::int AS psm, count(*)::int AS n
        FROM banded GROUP BY band ORDER BY band::int`,
  );
}

/** Resale price per square metre by number of primary schools within 1 km, last 24 months. */
export function schoolPremium(db: Db) {
  return rows<{ schools: string; psm: number; n: number }>(
    db,
    sql`WITH latest AS (SELECT max(month) AS m FROM resale_transactions)
        SELECT CASE WHEN s.primary_schools_1km >= 3 THEN '3+' ELSE s.primary_schools_1km::text END AS schools,
               round(percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price / t.floor_area_sqm))::int AS psm,
               count(*)::int AS n
        FROM resale_transactions t JOIN block_summary s ON s.block_id = t.block_id CROSS JOIN latest l
        WHERE t.month > l.m - interval '24 months'
        GROUP BY 1 ORDER BY 1`,
  );
}

/** Latest BTO price range per town next to the 12-month median resale price, for 4-room flats. */
export function btoVsResale(db: Db) {
  return rows<{ town: string; year: string; bto_low: number; bto_high: number; resale: number | null; n: number }>(
    db,
    sql`WITH bto AS (
          SELECT DISTINCT ON (town) town, period AS year, value AS bto_low, value_high AS bto_high
          FROM town_stats WHERE metric = 'bto_price' AND flat_type = '4-ROOM'
          ORDER BY town, period DESC
        ), latest AS (SELECT max(month) AS m FROM resale_transactions),
        resale AS (
          SELECT b.town, percentile_cont(0.5) WITHIN GROUP (ORDER BY t.price) AS median, count(*) AS n
          FROM resale_transactions t JOIN blocks b ON b.id = t.block_id CROSS JOIN latest l
          WHERE t.flat_type = '4-ROOM' AND t.month > l.m - interval '12 months'
          GROUP BY b.town
        )
        SELECT bto.town, bto.year, bto.bto_low::int, bto.bto_high::int, round(resale.median)::int AS resale, coalesce(resale.n, 0)::int AS n
        FROM bto LEFT JOIN resale ON resale.town = bto.town
        ORDER BY bto.town`,
  );
}

/** The 10 cheapest blocks to rent a 4-room within 400 m of an MRT/LRT exit, on at least 3 rentals. */
export function cheapNearMrt(db: Db) {
  return rows<{ id: number; block: string; street: string; town: string; mrt: string; mrt_m: number; rent: number; n: number }>(
    db,
    sql`SELECT b.id, b.block, b.street, b.town, s.nearest_mrt_name AS mrt, s.nearest_mrt_m AS mrt_m,
               (s.median_rent ->> '4-ROOM')::int AS rent, (s.rent_counts ->> '4-ROOM')::int AS n
        FROM block_summary s JOIN blocks b ON b.id = s.block_id
        WHERE s.nearest_mrt_m <= 400 AND (s.rent_counts ->> '4-ROOM')::int >= 3
        ORDER BY rent, n DESC LIMIT 10`,
  );
}

export const INSIGHTS = {
  'rent-trend': rentTrend,
  'rent-change-by-town': rentChangeByTown,
  'lease-decay': leaseDecay,
  'mrt-premium': mrtPremium,
  'school-premium': schoolPremium,
  'bto-vs-resale': btoVsResale,
  'cheap-near-mrt': cheapNearMrt,
} as const;

export type InsightName = keyof typeof INSIGHTS;
