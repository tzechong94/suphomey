import { describe, expect, it } from 'vitest';
import { parseSearchState, serializeSearchState } from '@/lib/client/preferences';
import { describeClosure, nextClosure } from '@/lib/closures';
import { distance, freeParking, moneyShort, titleCase } from '@/lib/format';
import { decodeMapPayload, encodeMapPayload, type MapBlock, type MapRow } from '@/lib/map-data';
import { rankBlocks } from '@/lib/rank';
import { vibesFor } from '@/lib/vibes';

const row = (over: Partial<MapRow> = {}): MapRow => ({
  id: 1,
  lat: 1.3521234,
  lng: 103.8198765,
  label: 'Blk 1 Test Street',
  town: 'BISHAN',
  leaseStartYear: 1990,
  maxFloor: 12,
  nearestMrtM: 300,
  nearestMrtName: 'Bishan MRT',
  nearestHawkerM: 200,
  nearestParkM: 100,
  nearestClinicM: null,
  nearestPreschoolM: 50,
  primarySchools1km: 2,
  busStops400m: 4,
  medianRent: { '4-ROOM': 3200 },
  medianPrice: {},
  rentCounts: { '4-ROOM': 7 },
  priceCounts: {},
  ...over,
});

describe('map payload', () => {
  it('round-trips through the columnar format', () => {
    const [block] = decodeMapPayload(encodeMapPayload([row()]));
    expect(block).toMatchObject({ id: 1, lat: 1.35212, lng: 103.81988, nearestClinicM: null, medianRent: { '4-ROOM': 3200 }, rentCount: { '4-ROOM': 7 }, medianPrice: {} });
  });

  it('drops blocks without coordinates', () => {
    expect(encodeMapPayload([row({ lat: null })]).id).toEqual([]);
  });
});

describe('rankBlocks', () => {
  const block = (id: number, rent: number, count: number, mrt: number): MapBlock =>
    decodeMapPayload(encodeMapPayload([row({ id, medianRent: { '4-ROOM': rent }, rentCounts: { '4-ROOM': count }, nearestMrtM: mrt })]))[0]!;
  const blocks = [block(1, 3000, 10, 300), block(2, 1500, 1, 300), block(3, 2800, 4, 300), block(4, 2000, 9, 2000)];
  const state = { mode: 'rent' as const, flatType: '4-ROOM' as const, max: null, prefs: { mrt: 'must' as const } };

  it('filters out blocks that fail a must-have', () => {
    expect(rankBlocks(blocks, state).passing.map((r) => r.block.id)).not.toContain(4);
  });

  it('does not let a single odd rental top "cheapest first"', () => {
    // Block 2's $1,500 comes from one rental, so it ranks after blocks with enough data.
    expect(rankBlocks(blocks, state, 'cheapest').passing.map((r) => r.block.id)).toEqual([3, 1, 2]);
  });

  it('breaks match ties by how much data backs the price', () => {
    expect(rankBlocks(blocks, state, 'match').passing.map((r) => r.block.id)).toEqual([1, 3, 2]);
  });
});

describe('search state in the URL', () => {
  it('round-trips', () => {
    const state = { mode: 'buy' as const, flatType: '5-ROOM' as const, max: 700000, prefs: { mrt: 'must' as const, park: 'nice' as const } };
    expect(parseSearchState(new URLSearchParams(serializeSearchState(state)))).toEqual(state);
  });

  it('ignores junk and falls back to defaults', () => {
    const state = parseSearchState(new URLSearchParams('mode=lease&type=9-ROOM&max=-5&must=mrt,teleporter'));
    expect(state).toMatchObject({ mode: 'rent', flatType: '4-ROOM', max: null, prefs: { mrt: 'must' } });
  });
});

describe('closures', () => {
  const closures = [
    { start: '2026-03-30', end: '2026-03-31', reason: 'Cleaning' },
    { start: '2026-12-14', end: '2026-12-15', reason: 'Cleaning' },
  ];
  it('finds the next closure, or the current one', () => {
    expect(nextClosure(closures, '2026-10-15')).toMatchObject({ start: '2026-12-14', ongoing: false });
    expect(nextClosure(closures, '2026-03-31')).toMatchObject({ start: '2026-03-30', ongoing: true });
    expect(nextClosure(closures, '2026-12-16')).toBeNull();
  });
  it('describes it in plain words', () => {
    expect(describeClosure({ ...closures[1]!, ongoing: false })).toBe('Next closed 14 Dec to 15 Dec for cleaning');
  });
});

describe('formatting', () => {
  it('rounds distances and switches to km on the rounded value', () => {
    expect(distance(233)).toBe('230 m');
    expect(distance(995)).toBe('1.0 km');
    expect(distance(null)).toBe('no data');
  });
  it('keeps acronyms upper case when title-casing', () => {
    expect(titleCase('PCF SPARKLETOTS PRESCHOOL @ TECK GHEE (CC)')).toBe('PCF Sparkletots Preschool @ Teck Ghee (CC)');
  });
  it('explains free parking codes', () => {
    expect(freeParking('SUN & PH FR 7AM-10.30PM')).toBe('Sundays and public holidays, 7am to 10.30pm');
    expect(freeParking('NO')).toBeNull();
  });
  it('shortens money', () => {
    expect(moneyShort(650_000)).toBe('$650k');
    expect(moneyShort(1_180_000)).toBe('$1.18M');
  });
});

describe('vibes', () => {
  const base = { hasMarketHawker: false, remainingLeaseYears: 70, maxFloor: 12, nearestMrtM: 600, nearestHawkerM: 600, primarySchools1km: 0, playgrounds500m: 0, nearestParkM: 500, busStops400m: 2 };
  it('says nothing when nothing stands out', () => {
    expect(vibesFor(base)).toEqual([]);
  });
  it('calls out what does, capped at four', () => {
    const vibes = vibesFor({ ...base, hasMarketHawker: true, nearestMrtM: 100, remainingLeaseYears: 90, maxFloor: 40, primarySchools1km: 3 });
    expect(vibes).toHaveLength(4);
    expect(vibes[0]?.text).toContain('Hawker downstairs');
  });
});
