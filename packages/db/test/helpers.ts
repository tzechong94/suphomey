import type { Db } from '../src/client';
import * as schema from '../src/schema';

export { createTestDb } from '../src/testing';

/**
 * A tiny town: two blocks on Bishan St 22 and one on Bishan St 23, an MRT exit,
 * a hawker centre, and a handful of rentals and resales.
 */
export async function seedFixture(db: Db) {
  const [b1, b2, b3] = await db
    .insert(schema.blocks)
    .values([
      { key: '230|BISHAN ST 22', block: '230', street: 'BISHAN ST 22', town: 'BISHAN', postal: '570230', lat: 1.358, lng: 103.846, leaseStartYear: 1992 },
      { key: '231|BISHAN ST 22', block: '231', street: 'BISHAN ST 22', town: 'BISHAN', postal: '570231', lat: 1.3585, lng: 103.8465, leaseStartYear: 1992 },
      { key: '301|BISHAN ST 23', block: '301', street: 'BISHAN ST 23', town: 'BISHAN', postal: '570301', lat: 1.36, lng: 103.85, leaseStartYear: 1985 },
    ])
    .returning();
  const unlocated = (
    await db.insert(schema.blocks).values({ key: '999|NOWHERE RD', block: '999', street: 'NOWHERE RD', town: 'BISHAN' }).returning()
  )[0]!;
  // Block "3": a substring of 230, 231 and 301, and sorts after "230" as text, which tests search ranking.
  await db.insert(schema.blocks).values({ key: '3|BISHAN ST 23', block: '3', street: 'BISHAN ST 23', town: 'BISHAN' });
  await db.insert(schema.blockSummary).values([b1!, b2!, b3!, unlocated].map((b) => ({ blockId: b.id, nearestMrtM: 400 })));

  const [mrt, hawker] = await db
    .insert(schema.amenities)
    .values([
      { kind: 'mrt_exit', sourceId: 'BISHAN MRT STATION|Exit A', name: 'Bishan', lat: 1.351, lng: 103.848, details: { exit: 'Exit A' } },
      { kind: 'hawker', sourceId: 'Bishan Hawker', name: 'Bishan Hawker', lat: 1.357, lng: 103.845, details: { foodStalls: 40 } },
    ])
    .returning();
  await db.insert(schema.blockAmenities).values([
    { blockId: b1!.id, amenityId: hawker!.id, distanceM: 150 },
    { blockId: b1!.id, amenityId: mrt!.id, distanceM: 790 },
  ]);

  const rent = (blockId: number, month: string, amount: number, flatType = '4-ROOM') => ({ blockId, month, flatType, rent: amount });
  await db.insert(schema.rentalTransactions).values([
    rent(b1!.id, '2026-09-01', 3000),
    rent(b1!.id, '2026-08-01', 3200),
    rent(b1!.id, '2026-08-01', 2800),
    rent(b2!.id, '2026-07-01', 3100),
    rent(b2!.id, '2026-06-01', 2900),
    rent(b3!.id, '2026-05-01', 2500),
    rent(b1!.id, '2024-01-01', 2000), // older than every lookback window
    rent(b1!.id, '2026-09-01', 2400, '3-ROOM'),
  ]);
  await db.insert(schema.resaleTransactions).values([
    { blockId: b1!.id, month: '2026-09-01', flatType: '4-ROOM', storeyLow: 10, storeyHigh: 12, floorAreaSqm: 92, flatModel: 'Model A', leaseStartYear: 1992, price: 650_000 },
  ]);
  return { b1: b1!, b2: b2!, b3: b3!, unlocated };
}
