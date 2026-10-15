// @vitest-environment node
import { refreshPriceSummary, schema, type Db } from '@suphomey/db';
import { createTestDb } from '@suphomey/db/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Route handlers call getDb(); point it at an in-memory Postgres instead.
let db: Db;
vi.mock('@suphomey/db', async (importOriginal) => ({ ...(await importOriginal<typeof import('@suphomey/db')>()), getDb: () => db }));

const { GET: getBlocks } = await import('@/app/api/blocks/route');
const { GET: searchBlocks } = await import('@/app/api/blocks/search/route');
const { GET: getBlock } = await import('@/app/api/blocks/[id]/route');
const { GET: priceCheck } = await import('@/app/api/price-check/route');
const { GET: cron } = await import('@/app/api/cron/[job]/route');
const { GET: insight } = await import('@/app/api/insights/[name]/route');

let close: () => Promise<void>;
let blockId: number;
const req = (path: string, headers?: Record<string, string>) => new Request(`http://test${path}`, { headers });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  const [b] = await db
    .insert(schema.blocks)
    .values({ key: '230|BISHAN ST 22', block: '230', street: 'BISHAN ST 22', town: 'BISHAN', postal: '570230', lat: 1.358, lng: 103.846, leaseStartYear: 1992 })
    .returning();
  blockId = b!.id;
  await db.insert(schema.blockSummary).values({ blockId, nearestMrtM: 400, nearestMrtName: 'Bishan MRT' });
  await db.insert(schema.rentalTransactions).values([2800, 2900, 3000, 3100, 3200].map((rent) => ({ blockId, month: '2026-09-01', flatType: '4-ROOM', rent })));
  await refreshPriceSummary(db);
});
afterAll(() => close());

describe('GET /api/blocks', () => {
  it('returns the columnar map payload with CDN caching', async () => {
    const res = await getBlocks();
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
    const body = await res.json();
    expect(body.id).toEqual([blockId]);
    expect(body.label).toEqual(['Blk 230 Bishan Street 22']);
  });
});

describe('GET /api/blocks/search', () => {
  it('validates the query', async () => {
    const res = await searchBlocks(req('/api/blocks/search?q=a'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('at least 2 characters');
  });

  it('finds by postal code', async () => {
    const body = await (await searchBlocks(req('/api/blocks/search?q=570230'))).json();
    expect(body).toEqual([{ id: blockId, label: 'Blk 230 Bishan Street 22', town: 'Bishan', postal: '570230' }]);
  });
});

describe('GET /api/blocks/:id', () => {
  it('returns 404 for unknown or malformed ids', async () => {
    expect((await getBlock(req('/api/blocks/999'), params({ id: '999' }))).status).toBe(404);
    expect((await getBlock(req('/api/blocks/abc'), params({ id: 'abc' }))).status).toBe(404);
  });

  it('returns the profile with lease maths and medians', async () => {
    const body = await (await getBlock(req(`/api/blocks/${blockId}`), params({ id: String(blockId) }))).json();
    expect(body).toMatchObject({ id: blockId, label: 'Blk 230 Bishan Street 22', leaseStartYear: 1992, summary: { medianRent: { '4-ROOM': 3000 }, rentCounts: { '4-ROOM': 5 } } });
  });
});

describe('GET /api/price-check', () => {
  it('judges an asking rent against the block', async () => {
    const body = await (await priceCheck(req(`/api/price-check?blockId=${blockId}&kind=rent&flatType=4-ROOM&amount=3600`))).json();
    expect(body.result).toMatchObject({ verdict: 'atas', median: 3000, sample: { scope: 'block', count: 5 } });
  });

  it('returns a null result when there are too few deals', async () => {
    const body = await (await priceCheck(req(`/api/price-check?blockId=${blockId}&kind=resale&flatType=4-ROOM&amount=500000`))).json();
    expect(body.result).toBeNull();
  });

  it('rejects bad input with a readable reason', async () => {
    const res = await priceCheck(req(`/api/price-check?blockId=${blockId}&kind=rent&flatType=4-ROOM&amount=-1`));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^amount:/);
  });
});

describe('GET /api/cron/:job', () => {
  it('refuses requests without the cron secret', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    expect((await cron(req('/api/cron/dengue'), params({ job: 'dengue' }))).status).toBe(401);
    expect((await cron(req('/api/cron/dengue', { authorization: 'Bearer nope' }), params({ job: 'dengue' }))).status).toBe(401);
    // An unset secret must not mean "open to everyone".
    vi.stubEnv('CRON_SECRET', '');
    expect((await cron(req('/api/cron/dengue', { authorization: 'Bearer ' }), params({ job: 'dengue' }))).status).toBe(401);
    vi.unstubAllEnvs();
  });

  it('404s unknown jobs once authorised', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    expect((await cron(req('/api/cron/nope', { authorization: 'Bearer s3cret' }), params({ job: 'nope' }))).status).toBe(404);
    vi.unstubAllEnvs();
  });
});

describe('GET /api/insights/:name', () => {
  it('serves known insights and 404s the rest', async () => {
    expect((await insight(req('/api/insights/mrt-premium'), params({ name: 'mrt-premium' }))).status).toBe(200);
    expect((await insight(req('/api/insights/constructor'), params({ name: 'constructor' }))).status).toBe(404);
  });
});
