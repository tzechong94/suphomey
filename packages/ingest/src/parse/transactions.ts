import { blockKey, normalizeFlatType, type FlatType } from '@suphomey/core';
import { z } from 'zod';
import type { CsvRow } from '../csv';

export type ResaleRecord = {
  key: string;
  town: string;
  /** First day of the month, "YYYY-MM-01". */
  month: string;
  flatType: FlatType;
  storeyLow: number;
  storeyHigh: number;
  floorAreaSqm: number;
  flatModel: string;
  leaseStartYear: number;
  price: number;
};

export type RentalRecord = {
  key: string;
  town: string;
  month: string;
  flatType: FlatType;
  rent: number;
};

export type Parsed<T> = { records: T[]; rejected: { row: number; reason: string }[] };

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM');
const text = z.string().trim().min(1);
const flatType = text.transform((s, ctx) => {
  const t = normalizeFlatType(s);
  if (!t) ctx.addIssue({ code: 'custom', message: `unknown flat type "${s}"` });
  return t as FlatType;
});
const positive = z.coerce.number().positive();

const resaleRow = z.object({
  month,
  town: text,
  flat_type: flatType,
  block: text,
  street_name: text,
  storey_range: z.string().regex(/^\d+ TO \d+$/, 'storey_range must look like "10 TO 12"'),
  floor_area_sqm: positive,
  flat_model: text,
  lease_commence_date: z.coerce.number().int().min(1960).max(2100),
  resale_price: positive,
});

const rentalRow = z.object({
  rent_approval_date: month,
  town: text,
  block: text,
  street_name: text,
  flat_type: flatType,
  monthly_rent: positive,
});

function parseRows<S extends z.ZodType, T>(rows: CsvRow[], schema: S, map: (row: z.infer<S>) => T): Parsed<T> {
  const records: T[] = [];
  const rejected: Parsed<T>['rejected'] = [];
  rows.forEach((row, i) => {
    const result = schema.safeParse(row);
    if (result.success) records.push(map(result.data));
    else rejected.push({ row: i + 2, reason: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ') });
  });
  return { records, rejected };
}

export function parseResale(rows: CsvRow[]): Parsed<ResaleRecord> {
  return parseRows(rows, resaleRow, (r) => {
    const [low, high] = r.storey_range.split(' TO ').map(Number) as [number, number];
    return {
      key: blockKey(r.block, r.street_name),
      town: r.town.toUpperCase(),
      month: `${r.month}-01`,
      flatType: r.flat_type,
      storeyLow: low,
      storeyHigh: high,
      floorAreaSqm: r.floor_area_sqm,
      flatModel: r.flat_model,
      leaseStartYear: r.lease_commence_date,
      price: Math.round(r.resale_price),
    };
  });
}

export function parseRentals(rows: CsvRow[]): Parsed<RentalRecord> {
  return parseRows(rows, rentalRow, (r) => ({
    key: blockKey(r.block, r.street_name),
    town: r.town.toUpperCase(),
    month: `${r.rent_approval_date}-01`,
    flatType: r.flat_type,
    rent: Math.round(r.monthly_rent),
  }));
}
