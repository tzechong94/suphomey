import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  return parse(text, { columns: true, skip_empty_lines: true, bom: true, trim: true }) as CsvRow[];
}

export async function readCsv(file: string): Promise<CsvRow[]> {
  return parseCsv(await readFile(file, 'utf8'));
}

/** data.gov.sg uses "na", "-" and "" for missing values, sometimes in the same file. */
export function blankToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const v = value.trim();
  return v === '' || v.toLowerCase() === 'na' || v === '-' || v.toLowerCase() === 'nil' ? null : v;
}

export function toNumber(value: string | undefined): number | null {
  const v = blankToNull(value);
  if (v === null) return null;
  const n = Number(v.replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}
