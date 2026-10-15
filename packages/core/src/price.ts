/**
 * Fair Price Check: where an asking price sits among real transactions for the
 * same flat type, preferring the narrowest comparison with enough data.
 */
export type SampleScope = 'block' | 'street' | 'town';

export type PriceSample = { scope: SampleScope; values: number[]; fromMonth: string; toMonth: string };

/** Below this many transactions a comparison is too noisy to judge against. */
export const MIN_SAMPLE = 5;

/** The first scope (block, then street, then town) with enough transactions. */
export function chooseSample(samples: PriceSample[]): PriceSample | null {
  return samples.find((s) => s.values.length >= MIN_SAMPLE) ?? null;
}

/**
 * Percentile rank of value within values (0 to 100): the share of transactions
 * below it, counting ties as half. An amount equal to the median scores 50.
 */
export function percentileRank(values: number[], value: number): number {
  if (values.length === 0) throw new Error('percentileRank needs at least one value');
  let below = 0;
  let equal = 0;
  for (const v of values) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return Math.round((100 * (below + equal / 2)) / values.length);
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) throw new Error('quantile needs at least one value');
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export type Verdict = 'steal' | 'good' | 'fair' | 'pricey' | 'atas';

export const VERDICTS: Record<Verdict, { headline: string; tone: 'great' | 'good' | 'neutral' | 'warn' | 'bad' }> = {
  steal: { headline: 'Cheaper than most. Chope it before someone else does.', tone: 'great' },
  good: { headline: 'Below the usual. Your wallet approves.', tone: 'good' },
  fair: { headline: 'Right around what people actually pay. Fair game.', tone: 'neutral' },
  pricey: { headline: 'A bit above the usual. Some room to negotiate?', tone: 'warn' },
  atas: { headline: 'Bit atas. Most people here paid less.', tone: 'bad' },
};

export function verdictFor(percentile: number): Verdict {
  if (percentile <= 20) return 'steal';
  if (percentile <= 40) return 'good';
  if (percentile <= 60) return 'fair';
  if (percentile <= 80) return 'pricey';
  return 'atas';
}

export type PriceCheck = {
  verdict: Verdict;
  percentile: number;
  /** Amount relative to the median, e.g. 0.12 = 12% above. */
  vsMedian: number;
  median: number;
  p25: number;
  p75: number;
  sample: { scope: SampleScope; count: number; fromMonth: string; toMonth: string };
};

export function checkPrice(samples: PriceSample[], amount: number): PriceCheck | null {
  const sample = chooseSample(samples);
  if (!sample) return null;
  const median = quantile(sample.values, 0.5);
  const percentile = percentileRank(sample.values, amount);
  return {
    verdict: verdictFor(percentile),
    percentile,
    vsMedian: Math.round(((amount - median) / median) * 1000) / 1000,
    median: Math.round(median),
    p25: Math.round(quantile(sample.values, 0.25)),
    p75: Math.round(quantile(sample.values, 0.75)),
    sample: { scope: sample.scope, count: sample.values.length, fromMonth: sample.fromMonth, toMonth: sample.toMonth },
  };
}
