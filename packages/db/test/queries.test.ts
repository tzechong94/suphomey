import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/client';
import { refreshPriceSummary } from '../src/maintenance';
import { getBlock, getMapBlocks, getMonthlyMedians, getPriceSamples, searchBlocks } from '../src/queries';
import { createTestDb, seedFixture } from './helpers';

let db: Db;
let close: () => Promise<void>;
let fx: Awaited<ReturnType<typeof seedFixture>>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  fx = await seedFixture(db);
  await refreshPriceSummary(db);
});
afterAll(() => close());

describe('getMapBlocks', () => {
  it('returns only blocks that have coordinates', async () => {
    const rows = await getMapBlocks(db);
    expect(rows.map((r) => r.block)).toEqual(['230', '231', '301']);
  });

  it('carries the 12-month medians computed by refreshPriceSummary', async () => {
    const b1 = (await getMapBlocks(db)).find((r) => r.id === fx.b1.id)!;
    // 4-room rents within 12 months of the latest month: 3000, 3200, 2800 (the 2024 rental is excluded).
    expect(b1.medianRent).toEqual({ '4-ROOM': 3000, '3-ROOM': 2400 });
    expect(b1.rentCounts).toEqual({ '4-ROOM': 3, '3-ROOM': 1 });
    expect(b1.medianPrice).toEqual({ '4-ROOM': 650000 });
    expect(b1.priceCounts).toEqual({ '4-ROOM': 1 });
  });
});

describe('searchBlocks', () => {
  it('finds a block by exact postal code', async () => {
    expect((await searchBlocks(db, '570231')).map((r) => r.block)).toEqual(['231']);
  });

  it('matches words in any order', async () => {
    expect((await searchBlocks(db, '22 231 bishan')).map((r) => r.block)).toEqual(['231']);
  });

  it('ranks an exact block number above partial matches', async () => {
    const results = await searchBlocks(db, 'bishan 3');
    expect(results.map((r) => r.block)).toEqual(['3', '230', '231', '301']);
  });

  it('ignores queries that are too short or only LIKE wildcards', async () => {
    expect(await searchBlocks(db, 'b')).toEqual([]);
    expect(await searchBlocks(db, '%%')).toEqual([]);
    expect(await searchBlocks(db, '_ %')).toEqual([]);
  });
});

describe('getBlock', () => {
  it('returns the block with nearby places sorted by distance', async () => {
    const block = await getBlock(db, fx.b1.id);
    expect(block?.street).toBe('BISHAN ST 22');
    expect(block?.nearby.map((n) => [n.kind, n.distanceM])).toEqual([
      ['hawker', 150],
      ['mrt_exit', 790],
    ]);
  });

  it('returns null for an unknown id', async () => {
    expect(await getBlock(db, 999_999)).toBeNull();
  });
});

describe('getMonthlyMedians', () => {
  it('groups by month and takes the median', async () => {
    const rows = await getMonthlyMedians(db, fx.b1.id, 'rent', '4-ROOM');
    expect(rows).toEqual([
      { month: '2024-01-01', median: 2000, count: 1 },
      { month: '2026-08-01', median: 3000, count: 2 },
      { month: '2026-09-01', median: 3000, count: 1 },
    ]);
  });
});

describe('getPriceSamples', () => {
  it('returns block, street and town samples within their lookback windows', async () => {
    const samples = await getPriceSamples(db, fx.b1.id, 'rent', '4-ROOM');
    const byScope = Object.fromEntries(samples!.map((s) => [s.scope, [...s.values].sort()]));
    expect(byScope.block).toEqual([2800, 3000, 3200]);
    expect(byScope.street).toEqual([2800, 2900, 3000, 3100, 3200]);
    expect(byScope.town).toEqual([2500, 2800, 2900, 3000, 3100, 3200]);
  });

  it('returns null for an unknown block', async () => {
    expect(await getPriceSamples(db, 999_999, 'rent', '4-ROOM')).toBeNull();
  });
});
