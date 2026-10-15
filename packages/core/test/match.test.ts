import { describe, expect, it } from 'vitest';
import { ramp, scoreBlock, type BlockFacts } from '../src/match';

const block: BlockFacts = {
  leaseStartYear: 2000,
  nearestMrtM: 300,
  nearestHawkerM: 950,
  nearestParkM: 1000,
  nearestClinicM: null,
  nearestPreschoolM: 150,
  primarySchools1km: 1,
  busStops400m: 5,
  medianRent: { '4-ROOM': 3200 },
  medianPrice: { '4-ROOM': 620_000 },
};
const asOf = new Date(2026, 0, 1);

describe('ramp', () => {
  it('works for lower-is-better and higher-is-better values', () => {
    expect(ramp(300, 300, 1200)).toBe(1);
    expect(ramp(750, 300, 1200)).toBe(0.5);
    expect(ramp(5000, 300, 1200)).toBe(0);
    expect(ramp(1, 2, 0)).toBe(0.5);
  });
});

describe('scoreBlock', () => {
  it('gives 100% when nothing is selected', () => {
    expect(scoreBlock(block, {})).toEqual({ passes: true, percent: 100, parts: [], failedMusts: [] });
  });

  it('averages nice-to-haves into a percentage', () => {
    // MRT 300 m = 1.0, park 1,000 m = 0.0, so 50%.
    const result = scoreBlock(block, { mrt: 'nice', park: 'nice' }, { asOf });
    expect(result.percent).toBe(50);
    expect(result.parts.map((p) => p.criterion)).toEqual(['mrt', 'park']);
  });

  it('fails a must-have without affecting the percentage', () => {
    const result = scoreBlock(block, { hawker: 'must', mrt: 'nice' }, { asOf });
    expect(result.passes).toBe(true); // 950 m is within the 1,000 m must-have
    const strict = scoreBlock(block, { park: 'must', mrt: 'nice' }, { asOf });
    expect(strict.passes).toBe(false);
    expect(strict.failedMusts).toEqual(['park']);
    expect(strict.percent).toBe(100);
  });

  it('treats missing data as failing, never as passing', () => {
    const result = scoreBlock(block, { clinic: 'must' });
    expect(result.passes).toBe(false);
    expect(result.parts[0]?.explanation).toBe('Nearest CHAS clinic: no data');
  });

  it('scores the budget against the median for the chosen flat type', () => {
    const ctx = { asOf, budget: { mode: 'rent' as const, flatType: '4-ROOM' as const, max: 3200 } };
    const result = scoreBlock(block, { budget: 'must' }, ctx);
    expect(result.passes).toBe(true); // exactly at budget
    expect(scoreBlock(block, { budget: 'nice' }, ctx).percent).toBe(50);
    const noData = scoreBlock(block, { budget: 'must' }, { ...ctx, budget: { ...ctx.budget, flatType: '2-ROOM' } });
    expect(noData.passes).toBe(false);
  });

  it('uses remaining lease for the lease criterion', () => {
    // Lease from 2000, as of 2026: 73 years left, between 55 (0) and 85 (1).
    const result = scoreBlock(block, { lease: 'nice' }, { asOf });
    expect(result.percent).toBe(60);
    expect(result.parts[0]?.explanation).toBe('73 years of lease left');
  });
});
