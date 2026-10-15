import { describe, expect, it } from 'vitest';
import { remainingLeaseYears } from '../src/lease';
import { checkPrice, percentileRank, quantile, verdictFor, type PriceSample } from '../src/price';
import { monthlyInstalment, rentVsBuy, RENT_VS_BUY_DEFAULTS } from '../src/rent-vs-buy';

// Expected values below were computed independently (Python), not copied from this code.

describe('remainingLeaseYears', () => {
  it('counts down from 99 years, including months elapsed this year', () => {
    // 2026 - 1979 = 47 years, plus 9 months into October.
    expect(remainingLeaseYears(1979, new Date(2026, 9, 15))).toBe(51.3);
  });

  it('never goes below zero', () => {
    expect(remainingLeaseYears(1900, new Date(2026, 0, 1))).toBe(0);
  });
});

describe('percentiles', () => {
  it('ranks with ties counted as half', () => {
    expect(percentileRank([1, 2, 3, 4], 3)).toBe(63); // (2 below + 0.5) / 4
    expect(percentileRank([1, 2, 3, 4], 0)).toBe(0);
    expect(percentileRank([1, 2, 3, 4], 9)).toBe(100);
  });

  it('interpolates quantiles linearly', () => {
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(quantile([10, 20, 30, 40, 50], 0.25)).toBe(20);
  });

  it('maps percentiles to verdicts at the band edges', () => {
    expect(verdictFor(20)).toBe('steal');
    expect(verdictFor(21)).toBe('good');
    expect(verdictFor(60)).toBe('fair');
    expect(verdictFor(81)).toBe('atas');
  });
});

describe('checkPrice', () => {
  const sample = (scope: PriceSample['scope'], values: number[]): PriceSample => ({ scope, values, fromMonth: '2025-10-01', toMonth: '2026-09-01' });

  it('uses the narrowest scope with at least five transactions', () => {
    const result = checkPrice(
      [sample('block', [3000, 3100]), sample('street', [2800, 2900, 3000, 3100, 3200]), sample('town', [1000, 5000])],
      3600,
    );
    expect(result?.sample.scope).toBe('street');
    expect(result?.median).toBe(3000);
    expect(result?.vsMedian).toBe(0.2);
    expect(result?.verdict).toBe('atas');
  });

  it('returns null rather than judging on too little data', () => {
    expect(checkPrice([sample('block', [3000]), sample('town', [3000, 3100])], 3000)).toBeNull();
  });
});

describe('rent vs buy', () => {
  it('computes a standard amortised instalment', () => {
    expect(monthlyInstalment(400_000, 0.026, 25)).toBeCloseTo(1814.68, 2);
    expect(monthlyInstalment(120_000, 0, 10)).toBe(1000);
  });

  it('counts interest, upfront costs and opportunity cost, but not repaid principal', () => {
    const result = rentVsBuy({ ...RENT_VS_BUY_DEFAULTS, price: 500_000, monthlyRent: 2_500, rentChange: 0, priceChange: 0, horizonYears: 1 });
    // Year 1: interest 9,622 + upfront 15,000 + 2.5% on 140,000 cash = 28,122; rent 30,000.
    expect(result.rows[0]).toMatchObject({ year: 1, rentCost: 30_000, buyCost: 28_122 });
    expect(result.breakEvenYear).toBe(1);
    expect(result.grossYield).toBe(0.06);
  });

  it('finds no break-even when the flat loses value fast', () => {
    const result = rentVsBuy({ ...RENT_VS_BUY_DEFAULTS, price: 500_000, monthlyRent: 1_500, priceChange: -0.05, horizonYears: 10 });
    expect(result.breakEvenYear).toBeNull();
  });
});
