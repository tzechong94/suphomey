import { refreshPriceSummary, schema, type Db } from '@suphomey/db';
import { sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { SeedFiles } from './seed-files';

/** Postgres allows 65,535 bind parameters per statement. */
const MAX_PARAMS = 65_000;

export async function insertBatched<T extends Record<string, unknown>>(db: Db, table: PgTable, rows: T[]): Promise<void> {
  if (rows.length === 0) return;
  const size = Math.max(1, Math.floor(MAX_PARAMS / Object.keys(rows[0]!).length));
  for (let i = 0; i < rows.length; i += size) {
    await db.insert(table).values(rows.slice(i, i + size));
  }
}

/**
 * Replaces all data with the snapshot, inside one transaction: a failed seed
 * leaves the previous data untouched.
 */
export async function loadSeed(db: Db, seed: SeedFiles): Promise<void> {
  await db.transaction(async (tx) => {
    const t = tx as unknown as Db;
    await t.execute(sql`TRUNCATE blocks, amenities, risk_areas, town_stats RESTART IDENTITY CASCADE`);

    await insertBatched(t, schema.blocks, seed.blocks);
    const blockIds = new Map((await t.select({ id: schema.blocks.id, key: schema.blocks.key }).from(schema.blocks)).map((b) => [b.key, b.id]));
    const blockId = (key: string) => {
      const id = blockIds.get(key);
      if (id === undefined) throw new Error(`Seed references unknown block ${key}`);
      return id;
    };

    await insertBatched(t, schema.amenities, seed.amenities.map(({ kind, sourceId, name, lat, lng, details }) => ({ kind, sourceId, name, lat, lng, details })));
    const amenityRows = await t.select({ id: schema.amenities.id, kind: schema.amenities.kind, sourceId: schema.amenities.sourceId }).from(schema.amenities);
    const amenityIds = new Map(amenityRows.map((a) => [`${a.kind}|${a.sourceId}`, a.id]));

    await insertBatched(t, schema.blockSummary, seed.summaries.map(({ key, ...s }) => ({ blockId: blockId(key), ...s })));
    await insertBatched(
      t,
      schema.blockAmenities,
      seed.blockAmenities.flatMap(([key, kind, sourceId, distanceM]) => {
        const amenityId = amenityIds.get(`${kind}|${sourceId}`);
        return amenityId === undefined ? [] : [{ blockId: blockId(key), amenityId, distanceM }];
      }),
    );
    await insertBatched(t, schema.blockLandUse, seed.landUse.map(([key, landUse, areaM2]) => ({ blockId: blockId(key), landUse, areaM2 })));
    await insertBatched(t, schema.blockProgrammes, seed.programmes.map(({ key, ...p }) => ({ blockId: blockId(key), ...p })));
    await insertBatched(t, schema.riskAreas, seed.riskAreas);
    await insertBatched(t, schema.townStats, seed.townStats);
    await insertBatched(
      t,
      schema.resaleTransactions,
      seed.resale.map(([key, month, flatType, storeyLow, storeyHigh, floorAreaSqm, flatModel, leaseStartYear, price]) => ({
        blockId: blockId(key), month, flatType, storeyLow, storeyHigh, floorAreaSqm, flatModel, leaseStartYear, price,
      })),
    );
    await insertBatched(
      t,
      schema.rentalTransactions,
      seed.rentals.map(([key, month, flatType, rent]) => ({ blockId: blockId(key), month, flatType, rent })),
    );
    await refreshPriceSummary(t);
  });
}
