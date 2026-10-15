import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Db } from './client';
import {
  amenities,
  blockAmenities,
  blockLandUse,
  blockProgrammes,
  blocks,
  blockSummary,
  ingestionRuns,
  rentalTransactions,
  resaleTransactions,
  riskAreas,
  townStats,
} from './schema';

export type TransactionKind = 'rent' | 'resale';

/** Every located block with the facts the map and match score need. */
export async function getMapBlocks(db: Db) {
  return db
    .select({
      id: blocks.id,
      block: blocks.block,
      street: blocks.street,
      town: blocks.town,
      lat: blocks.lat,
      lng: blocks.lng,
      leaseStartYear: blocks.leaseStartYear,
      maxFloor: blocks.maxFloor,
      nearestMrtM: blockSummary.nearestMrtM,
      nearestMrtName: blockSummary.nearestMrtName,
      nearestHawkerM: blockSummary.nearestHawkerM,
      nearestParkM: blockSummary.nearestParkM,
      nearestClinicM: blockSummary.nearestClinicM,
      nearestPreschoolM: blockSummary.nearestPreschoolM,
      primarySchools1km: blockSummary.primarySchools1km,
      busStops400m: blockSummary.busStops400m,
      medianRent: blockSummary.medianRent,
      medianPrice: blockSummary.medianPrice,
      rentCounts: blockSummary.rentCounts,
      priceCounts: blockSummary.priceCounts,
    })
    .from(blocks)
    .innerJoin(blockSummary, eq(blockSummary.blockId, blocks.id))
    .where(and(isNotNull(blocks.lat), isNotNull(blocks.lng)))
    .orderBy(asc(blocks.id));
}

/**
 * Search by postal code, or by "block street" text. Words can come in any order
 * and abbreviations are matched against both forms ("ave" and "avenue").
 */
export async function searchBlocks(db: Db, query: string, limit = 8) {
  const q = query.trim().toUpperCase();
  if (q.length < 2) return [];
  const columns = { id: blocks.id, block: blocks.block, street: blocks.street, town: blocks.town, postal: blocks.postal };
  if (/^\d{6}$/.test(q)) return db.select(columns).from(blocks).where(eq(blocks.postal, q)).limit(limit);
  // Strip LIKE wildcards before splitting, so "%%" leaves no words rather than an empty word matching everything.
  const words = q.replace(/[%_\\]/g, '').split(/\s+/).filter(Boolean).slice(0, 6);
  if (words.length === 0) return [];
  const haystack = sql`(${blocks.block} || ' ' || ${blocks.street} || ' ' || ${blocks.town} || ' ' || coalesce(${blocks.postal}, ''))`;
  const conditions = words.map((w) => sql`${haystack} LIKE ${'%' + w + '%'}`);
  return db
    .select(columns)
    .from(blocks)
    .where(and(...conditions))
    // Exact block number matches first, then shorter streets (closer matches).
    .orderBy(
      sql`(${blocks.block} IN (${sql.join(words.map((w) => sql`${w}`), sql`, `)})) DESC`,
      sql`length(${blocks.street})`,
      asc(blocks.block),
    )
    .limit(limit);
}

export async function getBlock(db: Db, id: number) {
  const [row] = await db
    .select({ block: blocks, summary: blockSummary })
    .from(blocks)
    .leftJoin(blockSummary, eq(blockSummary.blockId, blocks.id))
    .where(eq(blocks.id, id));
  if (!row) return null;

  const [nearby, landUse, programmes] = await Promise.all([
    db
      .select({
        id: amenities.id,
        kind: amenities.kind,
        name: amenities.name,
        lat: amenities.lat,
        lng: amenities.lng,
        details: amenities.details,
        distanceM: blockAmenities.distanceM,
      })
      .from(blockAmenities)
      .innerJoin(amenities, eq(amenities.id, blockAmenities.amenityId))
      .where(eq(blockAmenities.blockId, id))
      .orderBy(asc(blockAmenities.distanceM)),
    db
      .select({ landUse: blockLandUse.landUse, areaM2: blockLandUse.areaM2 })
      .from(blockLandUse)
      .where(eq(blockLandUse.blockId, id))
      .orderBy(desc(blockLandUse.areaM2)),
    db.select().from(blockProgrammes).where(eq(blockProgrammes.blockId, id)),
  ]);
  return { ...row.block, summary: row.summary, nearby, landUse, programmes };
}

export async function getRiskAreas(db: Db) {
  return db.select().from(riskAreas);
}

/** Monthly median and count for one block and flat type: the price history chart. */
export async function getMonthlyMedians(db: Db, blockId: number, kind: TransactionKind, flatType: string) {
  const t = kind === 'rent' ? rentalTransactions : resaleTransactions;
  const value = kind === 'rent' ? rentalTransactions.rent : resaleTransactions.price;
  const rows = await db
    .select({
      month: t.month,
      median: sql<number>`round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${value}))::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(t)
    .where(and(eq(t.blockId, blockId), eq(t.flatType, flatType)))
    .groupBy(t.month)
    .orderBy(asc(t.month));
  return rows;
}

export async function getRecentResales(db: Db, blockId: number, limit = 20) {
  return db
    .select({
      month: resaleTransactions.month,
      flatType: resaleTransactions.flatType,
      storeyLow: resaleTransactions.storeyLow,
      storeyHigh: resaleTransactions.storeyHigh,
      floorAreaSqm: resaleTransactions.floorAreaSqm,
      flatModel: resaleTransactions.flatModel,
      price: resaleTransactions.price,
    })
    .from(resaleTransactions)
    .where(eq(resaleTransactions.blockId, blockId))
    .orderBy(desc(resaleTransactions.month), desc(resaleTransactions.price))
    .limit(limit);
}

export async function getRecentRentals(db: Db, blockId: number, limit = 20) {
  return db
    .select({ month: rentalTransactions.month, flatType: rentalTransactions.flatType, rent: rentalTransactions.rent })
    .from(rentalTransactions)
    .where(eq(rentalTransactions.blockId, blockId))
    .orderBy(desc(rentalTransactions.month), desc(rentalTransactions.rent))
    .limit(limit);
}

/**
 * Comparable transactions at three widening scopes, for the Fair Price Check.
 * Block and street look back 24 months (few transactions per block), town 12.
 */
export async function getPriceSamples(db: Db, blockId: number, kind: TransactionKind, flatType: string) {
  const [target] = await db.select({ street: blocks.street, town: blocks.town }).from(blocks).where(eq(blocks.id, blockId));
  if (!target) return null;
  const t = kind === 'rent' ? rentalTransactions : resaleTransactions;
  const value = kind === 'rent' ? rentalTransactions.rent : resaleTransactions.price;
  const [{ latest } = { latest: null }] = await db.select({ latest: sql<string | null>`max(${t.month})::text` }).from(t);
  if (!latest) return [];
  const monthsBack = (n: number) => sql`(${latest}::date - make_interval(months => ${n}))`;

  const scopes = [
    { scope: 'block' as const, months: 24, where: eq(t.blockId, blockId) },
    { scope: 'street' as const, months: 24, where: eq(blocks.street, target.street) },
    { scope: 'town' as const, months: 12, where: eq(blocks.town, target.town) },
  ];
  return Promise.all(
    scopes.map(async ({ scope, months, where }) => {
      const rows = await db
        .select({ value, month: sql<string>`${t.month}::text` })
        .from(t)
        .innerJoin(blocks, eq(blocks.id, t.blockId))
        .where(and(where, eq(t.flatType, flatType), sql`${t.month} > ${monthsBack(months)}`));
      const monthsSorted = rows.map((r) => r.month).sort();
      return {
        scope,
        values: rows.map((r) => r.value),
        fromMonth: monthsSorted[0] ?? latest,
        toMonth: monthsSorted.at(-1) ?? latest,
      };
    }),
  );
}

export async function getTownStats(db: Db, metric: string) {
  return db.select().from(townStats).where(eq(townStats.metric, metric)).orderBy(asc(townStats.period));
}

export async function getLatestRuns(db: Db) {
  return db
    .selectDistinctOn([ingestionRuns.dataset])
    .from(ingestionRuns)
    .orderBy(ingestionRuns.dataset, desc(ingestionRuns.startedAt));
}

export async function getDataFreshness(db: Db) {
  const [row] = await db
    .select({
      blocks: sql<number>`(SELECT count(*)::int FROM ${blocks})`,
      latestResale: sql<string | null>`(SELECT max(${resaleTransactions.month})::text FROM ${resaleTransactions})`,
      latestRental: sql<string | null>`(SELECT max(${rentalTransactions.month})::text FROM ${rentalTransactions})`,
    })
    .from(sql`(SELECT 1) AS one`);
  return row!;
}

