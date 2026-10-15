/**
 * HDB datasets name the same flat type differently ("4 ROOM" in resale data,
 * "4-ROOM" in rental data), so everything is normalised to one canonical set.
 */
export const FLAT_TYPES = [
  '1-ROOM',
  '2-ROOM',
  '3-ROOM',
  '4-ROOM',
  '5-ROOM',
  'EXECUTIVE',
  'MULTI-GENERATION',
] as const;

export type FlatType = (typeof FLAT_TYPES)[number];

export function normalizeFlatType(raw: string): FlatType | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  const rooms = /^([1-5])[\s-]?ROOM$/.exec(s);
  if (rooms) return `${rooms[1]}-ROOM` as FlatType;
  if (s === 'EXECUTIVE' || s === 'EXEC') return 'EXECUTIVE';
  if (s === 'MULTI-GENERATION' || s === 'MULTI GENERATION') return 'MULTI-GENERATION';
  return null;
}

/**
 * Resale, rental and HDB Property Information all use the same abbreviated
 * street names ("ANG MO KIO AVE 10"), so block number + street is a stable join
 * key across them. Whitespace and case are the only differences seen in the data.
 */
export function blockKey(block: string, street: string): string {
  const clean = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');
  return `${clean(block)}|${clean(street)}`;
}

export function parseBlockKey(key: string): { block: string; street: string } {
  const [block = '', street = ''] = key.split('|');
  return { block, street };
}

/** Abbreviations used in HDB street names, expanded to what OneMap and humans use. */
const STREET_ABBREVIATIONS: Record<string, string> = {
  AVE: 'AVENUE',
  ST: 'STREET',
  RD: 'ROAD',
  DR: 'DRIVE',
  CRES: 'CRESCENT',
  CL: 'CLOSE',
  PL: 'PLACE',
  CTRL: 'CENTRAL',
  CTR: 'CENTRE',
  NTH: 'NORTH',
  STH: 'SOUTH',
  LOR: 'LORONG',
  JLN: 'JALAN',
  BT: 'BUKIT',
  KG: 'KAMPONG',
  TG: 'TANJONG',
  UPP: 'UPPER',
  GDNS: 'GARDENS',
  GDN: 'GARDEN',
  SQ: 'SQUARE',
  PK: 'PARK',
  TER: 'TERRACE',
  HTS: 'HEIGHTS',
  MKT: 'MARKET',
  "C'WEALTH": 'COMMONWEALTH',
};

export function expandStreet(street: string): string {
  return street
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .map((word) => STREET_ABBREVIATIONS[word] ?? word)
    .join(' ');
}

/** "ANG MO KIO AVE 10" -> "Ang Mo Kio Avenue 10" */
export function displayStreet(street: string): string {
  return expandStreet(street)
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
