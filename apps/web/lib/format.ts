import { displayStreet } from '@suphomey/core';

export const blockLabel = (block: string, street: string) => `Blk ${block} ${displayStreet(street)}`;

/** Acronyms that appear in place names in the source data and must stay upper case. */
const ACRONYMS = new Set(['PCF', 'CC', 'NTUC', 'MOE', 'SAP', 'YMCA', 'YWCA', 'HDB', 'MRT', 'LRT', 'AMK', 'PA', 'RC', 'CHIJ', 'ACS', 'SG', 'NUS', 'ITE', 'BLK', 'CDC', 'SCDF', 'MUIS']);

export const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s/(-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\b[A-Za-z]+\b/g, (w) => (ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w));

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-SG')}`;

/** $650,000 -> "$650k", $1,180,000 -> "$1.18M" */
export function moneyShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}k`;
  return money(n);
}

export function distance(m: number | null): string {
  if (m === null) return 'no data';
  const tens = Math.round(m / 10) * 10;
  // Decide on the rounded value, so 995 m reads "1.0 km" rather than "1000 m".
  return tens < 1000 ? `${tens} m` : `${(m / 1000).toFixed(1)} km`;
}

/** HDB's free parking codes, e.g. "SUN & PH FR 7AM-10.30PM" -> "Sundays and public holidays, 7am to 10.30pm". */
export function freeParking(raw: string): string | null {
  if (!raw || raw === 'NO') return null;
  const m = /^SUN & PH FR (\S+)-(\S+)$/.exec(raw.trim());
  return m ? `Sundays and public holidays, ${m[1]!.toLowerCase()} to ${m[2]!.toLowerCase()}` : raw.toLowerCase();
}

/** Walking minutes at about 80 m a minute (a relaxed pace), rounded up. */
export const walkMinutes = (m: number) => Math.max(1, Math.ceil(m / 80));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-01" -> "Sep 2026" */
export function monthLabel(isoDate: string): string {
  const [y, m] = isoDate.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

export const flatTypeLabel = (t: string) => (t === 'MULTI-GENERATION' ? 'Multi-gen' : t === 'EXECUTIVE' ? 'Executive' : t.replace('-ROOM', '-room'));
