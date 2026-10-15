import { schema, type Db } from '@suphomey/db';
import { createTestDb } from '@suphomey/db/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatasetKey } from '../src/datasets';
import { monthsBefore, runRefresh, type Fetcher } from '../src/refresh';

let db: Db;
let close: () => Promise<void>;
let blockId: number;

beforeEach(async () => {
  ({ db, close } = await createTestDb());
  const [b] = await db.insert(schema.blocks).values({ key: '406|ANG MO KIO AVE 10', block: '406', street: 'ANG MO KIO AVE 10', town: 'ANG MO KIO' }).returning();
  blockId = b!.id;
  await db.insert(schema.blockSummary).values({ blockId });
});
afterEach(() => close());

/** A fake data.gov.sg: returns fixed text per dataset, never touches the network. */
const fetcher =
  (files: Partial<Record<DatasetKey, string>>): Fetcher =>
  async (key) => {
    if (!(key in files)) throw new Error(`unexpected download: ${key}`);
    return Buffer.from(files[key]!);
  };

const RENTAL_HEADER = 'rent_approval_date,town,block,street_name,flat_type,monthly_rent';

describe('monthsBefore', () => {
  it('crosses year boundaries', () => {
    expect(monthsBefore('2026-02-01', 2)).toBe('2025-12-01');
    expect(monthsBefore('2026-09-01', 0)).toBe('2026-09-01');
  });
});

describe('rentals refresh', () => {
  it('reloads the last three months, keeps older rows, and recomputes medians', async () => {
    await db.insert(schema.rentalTransactions).values([
      { blockId, month: '2025-06-01', flatType: '3-ROOM', rent: 2000 }, // outside the reload window: kept
      { blockId, month: '2026-08-01', flatType: '3-ROOM', rent: 9999 }, // inside: replaced by the file
      { blockId, month: '2026-09-01', flatType: '3-ROOM', rent: 2600 },
    ]);
    const csv = [
      RENTAL_HEADER,
      '2026-08,ANG MO KIO,406,ANG MO KIO AVE 10,3-ROOM,2500',
      '2026-09,ANG MO KIO,406,ANG MO KIO AVE 10,3-ROOM,2600',
      '2026-10,ANG MO KIO,406,ANG MO KIO AVE 10,3-ROOM,2700',
    ].join('\n');

    const result = await runRefresh(db, 'rentals', fetcher({ rentals: csv }));

    expect(result.rows).toBe(3);
    const rents = (await db.select().from(schema.rentalTransactions).orderBy(schema.rentalTransactions.month)).map((r) => [r.month, r.rent]);
    expect(rents).toEqual([
      ['2025-06-01', 2000],
      ['2026-08-01', 2500],
      ['2026-09-01', 2600],
      ['2026-10-01', 2700],
    ]);
    const [summary] = await db.select().from(schema.blockSummary).where(eq(schema.blockSummary.blockId, blockId));
    // The 12 months up to Oct 2026 exclude June 2025: median of 2500, 2600, 2700.
    expect(summary?.medianRent).toEqual({ '3-ROOM': 2600 });
  });

  it('adds blocks it has never seen, without a location', async () => {
    const csv = [RENTAL_HEADER, '2026-10,TENGAH,131A,TENGAH GDN AVE,4-ROOM,3100'].join('\n');
    const result = await runRefresh(db, 'rentals', fetcher({ rentals: csv }));
    expect(result.message).toContain('1 new blocks');
    const [created] = await db.select().from(schema.blocks).where(eq(schema.blocks.key, '131A|TENGAH GDN AVE'));
    expect(created).toMatchObject({ town: 'TENGAH', lat: null });
  });

  it('records each run, including failures', async () => {
    await expect(runRefresh(db, 'rentals', fetcher({}))).rejects.toThrow('unexpected download');
    await runRefresh(db, 'rentals', fetcher({ rentals: RENTAL_HEADER }));
    const runs = await db.select().from(schema.ingestionRuns).orderBy(schema.ingestionRuns.id);
    expect(runs.map((r) => [r.dataset, r.status])).toEqual([
      ['rentals', 'failed'],
      ['rentals', 'ok'],
    ]);
    expect(runs[0]?.message).toContain('unexpected download');
  });
});

describe('hawker refresh', () => {
  it('updates closures for known centres only', async () => {
    await db.insert(schema.amenities).values({ kind: 'hawker', sourceId: 'Adam Road Food Centre', name: 'Adam Road Food Centre', lat: 1.32, lng: 103.81, details: { closures: [] } });
    const csv = [
      'name,latitude_hc,longitude_hc,q1_cleaningstartdate,q1_cleaningenddate,remarks_q1,no_of_food_stalls,status',
      'Adam Road Food Centre,1.32,103.81,30/3/2026,31/3/2026,nil,32,Existing',
      'Brand New Centre,1.30,103.80,1/4/2026,2/4/2026,nil,20,Existing (new)',
    ].join('\n');
    const result = await runRefresh(db, 'hawkers', fetcher({ hawkerClosures: csv }));
    expect(result.rows).toBe(1);
    const [adam] = await db.select().from(schema.amenities);
    expect(adam?.details.closures).toEqual([{ start: '2026-03-30', end: '2026-03-31', reason: 'Cleaning' }]);
  });
});

describe('dengue refresh', () => {
  it('replaces all risk areas', async () => {
    const square = { type: 'Polygon', coordinates: [[[103.8, 1.3], [103.81, 1.3], [103.81, 1.31], [103.8, 1.3]]] };
    await db.insert(schema.riskAreas).values({ kind: 'dengue', name: 'Old cluster', geometry: square as never });
    const fc = (props: Record<string, string>) => JSON.stringify({ features: [{ properties: props, geometry: square }] });
    await runRefresh(db, 'dengue', fetcher({ dengueClusters: fc({ LOCALITY: 'Bishan St 22', CASE_SIZE: '7' }), aedesAreas: '{"features":[]}' }));
    const areas = await db.select().from(schema.riskAreas);
    expect(areas.map((a) => [a.name, a.caseCount])).toEqual([['Bishan St 22', 7]]);
  });
});
