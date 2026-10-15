import { sql } from 'drizzle-orm';
import type { Db } from './client';

/**
 * Recomputes the 12-month medians and counts on block_summary. The window ends
 * at the latest month in the data rather than today, so an old snapshot still
 * shows sensible numbers.
 */
export async function refreshPriceSummary(db: Db): Promise<void> {
  await db.execute(sql`
    WITH rent AS (
      SELECT block_id, flat_type, percentile_cont(0.5) WITHIN GROUP (ORDER BY rent) AS median, count(*) AS n
      FROM rental_transactions
      WHERE month > (SELECT max(month) FROM rental_transactions) - interval '12 months'
      GROUP BY block_id, flat_type
    ), rent_by_block AS (
      SELECT block_id, jsonb_object_agg(flat_type, round(median)) AS medians, jsonb_object_agg(flat_type, n) AS counts, sum(n)::int AS n FROM rent GROUP BY block_id
    ), sale AS (
      SELECT block_id, flat_type, percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median, count(*) AS n
      FROM resale_transactions
      WHERE month > (SELECT max(month) FROM resale_transactions) - interval '12 months'
      GROUP BY block_id, flat_type
    ), sale_by_block AS (
      SELECT block_id, jsonb_object_agg(flat_type, round(median)) AS medians, jsonb_object_agg(flat_type, n) AS counts, sum(n)::int AS n FROM sale GROUP BY block_id
    )
    UPDATE block_summary s SET
      median_rent = coalesce(r.medians, '{}'::jsonb),
      rent_counts = coalesce(r.counts, '{}'::jsonb),
      rentals_12m = coalesce(r.n, 0),
      median_price = coalesce(p.medians, '{}'::jsonb),
      price_counts = coalesce(p.counts, '{}'::jsonb),
      resales_12m = coalesce(p.n, 0)
    FROM block_summary s2
    LEFT JOIN rent_by_block r ON r.block_id = s2.block_id
    LEFT JOIN sale_by_block p ON p.block_id = s2.block_id
    WHERE s.block_id = s2.block_id
  `);
}
