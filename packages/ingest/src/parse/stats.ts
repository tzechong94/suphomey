import { normalizeFlatType } from '@suphomey/core';
import { toNumber, type CsvRow } from '../csv';

export type TownStat = {
  metric: 'median_rent' | 'bto_price' | 'resale_index';
  period: string;
  town: string;
  flatType: string;
  value: number;
  valueHigh: number | null;
};

/** One row per (metric, period, town, flat type); later rows win. */
export function dedupeStats(stats: TownStat[]): TownStat[] {
  return [...new Map(stats.map((s) => [`${s.metric}|${s.period}|${s.town}|${s.flatType}`, s])).values()];
}

/**
 * Quarterly median rent per town and flat type ("na" / "-" rows are skipped).
 * The source file repeats every 2020-Q1 row verbatim, hence the dedupe.
 */
export function parseMedianRent(rows: CsvRow[]): TownStat[] {
  return dedupeStats(rows.flatMap((r) => {
    const value = toNumber(r.median_rent);
    const flatType = normalizeFlatType(r.flat_type!.replace(/-RM$/, ' ROOM'));
    if (value === null || !flatType) return [];
    return [{ metric: 'median_rent' as const, period: r.quarter!, town: r.town!.toUpperCase(), flatType, value, valueHigh: null }];
  }));
}

/** BTO (new flat) selling price range per town, room type and financial year, before grants. */
export function parseBtoPrices(rows: CsvRow[]): TownStat[] {
  return dedupeStats(rows.flatMap((r) => {
    const low = toNumber(r.min_selling_price);
    const high = toNumber(r.max_selling_price);
    const flatType = normalizeFlatType(r.room_type!.replace(/-room$/i, ' ROOM'));
    if (low === null || high === null || low === 0 || !flatType) return [];
    return [{ metric: 'bto_price' as const, period: r.financial_year!, town: r.town!.toUpperCase(), flatType, value: low, valueHigh: high }];
  }));
}

export function parseResaleIndex(rows: CsvRow[]): TownStat[] {
  return rows.flatMap((r) => {
    const value = toNumber(r.index);
    return value === null ? [] : [{ metric: 'resale_index' as const, period: r.quarter!, town: 'ALL', flatType: 'ALL', value, valueHigh: null }];
  });
}
