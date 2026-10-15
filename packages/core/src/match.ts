import type { FlatType } from './address';
import { remainingLeaseYears } from './lease';

/**
 * Match scoring. Each preference chip is "off", "nice" (adds to the match %) or
 * "must" (a hard filter). Each criterion turns a block's facts into a score
 * from 0 to 1 using a linear ramp between a "great" and a "poor" value, and
 * defines what passing as a must-have means. Thresholds are walking distances
 * people generally accept in Singapore's heat: about 800 m (10 minutes) for a
 * must-have, full marks within roughly 5 minutes.
 */
export type Preference = 'off' | 'nice' | 'must';

export const CRITERIA = ['mrt', 'hawker', 'primarySchool', 'park', 'clinic', 'preschool', 'busStops', 'lease', 'budget'] as const;
export type Criterion = (typeof CRITERIA)[number];

export type Preferences = Partial<Record<Criterion, Preference>>;

/** What the scorer needs to know about a block (a subset of block_summary). */
export type BlockFacts = {
  leaseStartYear: number | null;
  nearestMrtM: number | null;
  nearestHawkerM: number | null;
  nearestParkM: number | null;
  nearestClinicM: number | null;
  nearestPreschoolM: number | null;
  primarySchools1km: number;
  busStops400m: number;
  medianRent: Partial<Record<FlatType, number>>;
  medianPrice: Partial<Record<FlatType, number>>;
};

export type Budget = { mode: 'rent' | 'buy'; flatType: FlatType; max: number };

export type MatchContext = { budget?: Budget; asOf?: Date };

type Rule = {
  label: string;
  /** null = unknown (no data), which never passes a must-have and scores 0. */
  score: (b: BlockFacts, ctx: MatchContext) => number | null;
  passes: (b: BlockFacts, ctx: MatchContext) => boolean;
  explain: (b: BlockFacts, ctx: MatchContext) => string;
};

/** 1 at or better than `great`, 0 at or worse than `poor`, linear between. Works in either direction. */
export function ramp(value: number, great: number, poor: number): number {
  const t = (value - poor) / (great - poor);
  return Math.min(1, Math.max(0, t));
}

const metres = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);

const distanceRule = (label: string, field: keyof BlockFacts, great: number, poor: number, mustWithin: number): Rule => ({
  label,
  score: (b) => (b[field] === null ? null : ramp(b[field] as number, great, poor)),
  passes: (b) => b[field] !== null && (b[field] as number) <= mustWithin,
  explain: (b) => (b[field] === null ? `${label}: no data` : `${label}: ${metres(b[field] as number)} away`),
});

const leaseLeft = (b: BlockFacts, ctx: MatchContext) =>
  b.leaseStartYear === null ? null : remainingLeaseYears(b.leaseStartYear, ctx.asOf);

function budgetMedian(b: BlockFacts, budget: Budget | undefined): number | null {
  if (!budget) return null;
  return (budget.mode === 'rent' ? b.medianRent : b.medianPrice)[budget.flatType] ?? null;
}

export const RULES: Record<Criterion, Rule> = {
  mrt: distanceRule('Nearest MRT exit', 'nearestMrtM', 300, 1200, 800),
  hawker: distanceRule('Nearest hawker centre', 'nearestHawkerM', 400, 1500, 1000),
  park: distanceRule('Nearest park', 'nearestParkM', 200, 1000, 500),
  clinic: distanceRule('Nearest CHAS clinic', 'nearestClinicM', 300, 1200, 800),
  preschool: distanceRule('Nearest preschool', 'nearestPreschoolM', 200, 1000, 500),
  primarySchool: {
    label: 'Primary schools within 1 km',
    score: (b) => ramp(b.primarySchools1km, 2, 0),
    passes: (b) => b.primarySchools1km >= 1,
    explain: (b) => `${b.primarySchools1km} primary school${b.primarySchools1km === 1 ? '' : 's'} within 1 km`,
  },
  busStops: {
    label: 'Bus stops within 400 m',
    score: (b) => ramp(b.busStops400m, 4, 0),
    passes: (b) => b.busStops400m >= 2,
    explain: (b) => `${b.busStops400m} bus stop${b.busStops400m === 1 ? '' : 's'} within 400 m`,
  },
  lease: {
    label: 'Lease remaining',
    score: (b, ctx) => {
      const left = leaseLeft(b, ctx);
      return left === null ? null : ramp(left, 85, 55);
    },
    passes: (b, ctx) => (leaseLeft(b, ctx) ?? 0) >= 60,
    explain: (b, ctx) => {
      const left = leaseLeft(b, ctx);
      return left === null ? 'Lease: no data' : `${Math.floor(left)} years of lease left`;
    },
  },
  budget: {
    label: 'Fits your budget',
    // Full marks at 80% of budget or less, half at exactly the budget, zero at 120%.
    score: (b, ctx) => {
      const median = budgetMedian(b, ctx.budget);
      return median === null || !ctx.budget ? null : ramp(median, 0.8 * ctx.budget.max, 1.2 * ctx.budget.max);
    },
    passes: (b, ctx) => {
      const median = budgetMedian(b, ctx.budget);
      return median !== null && !!ctx.budget && median <= ctx.budget.max;
    },
    explain: (b, ctx) => {
      const median = budgetMedian(b, ctx.budget);
      if (!ctx.budget) return 'No budget set';
      if (median === null) return `No recent ${ctx.budget.flatType.toLowerCase()} ${ctx.budget.mode === 'rent' ? 'rentals' : 'sales'} here`;
      return `Typical ${ctx.budget.mode === 'rent' ? 'rent' : 'price'}: $${median.toLocaleString('en-SG')}`;
    },
  },
};

export type MatchPart = { criterion: Criterion; label: string; score: number; preference: Exclude<Preference, 'off'>; explanation: string };

export type MatchResult = {
  /** False when any must-have fails. */
  passes: boolean;
  /** 0 to 100, the mean score of the nice-to-haves; 100 when there are none. */
  percent: number;
  parts: MatchPart[];
  failedMusts: Criterion[];
};

export function scoreBlock(block: BlockFacts, prefs: Preferences, ctx: MatchContext = {}): MatchResult {
  const parts: MatchPart[] = [];
  const failedMusts: Criterion[] = [];
  for (const criterion of CRITERIA) {
    const preference = prefs[criterion] ?? 'off';
    if (preference === 'off') continue;
    const rule = RULES[criterion];
    if (preference === 'must' && !rule.passes(block, ctx)) failedMusts.push(criterion);
    parts.push({
      criterion,
      label: rule.label,
      score: rule.score(block, ctx) ?? 0,
      preference,
      explanation: rule.explain(block, ctx),
    });
  }
  const nice = parts.filter((p) => p.preference === 'nice');
  const percent = nice.length === 0 ? 100 : Math.round((100 * nice.reduce((sum, p) => sum + p.score, 0)) / nice.length);
  return { passes: failedMusts.length === 0, percent, parts, failedMusts };
}
