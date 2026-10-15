import { expandStreet, parseBlockKey } from '@suphomey/core';

export type Geocode = { key: string; postal: string; lat: number; lng: number };

type OneMapResult = {
  BLK_NO: string;
  ROAD_NAME: string;
  POSTAL: string;
  LATITUDE: string;
  LONGITUDE: string;
};

const SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search';

/**
 * OneMap search is fuzzy, so its first hit can be the same block number on a
 * different street. A hit is accepted only if the block number matches exactly
 * and every word of the expanded HDB street name appears in OneMap's road name.
 */
export function pickMatch(key: string, results: OneMapResult[]): Geocode | null {
  const { block, street } = parseBlockKey(key);
  const words = expandStreet(street).split(' ');
  for (const r of results) {
    if (r.BLK_NO.toUpperCase() !== block) continue;
    const road = r.ROAD_NAME.toUpperCase().split(/\s+/);
    if (!words.every((w) => road.includes(w))) continue;
    const lat = Number(r.LATITUDE);
    const lng = Number(r.LONGITUDE);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    return { key, postal: r.POSTAL, lat, lng };
  }
  return null;
}

async function search(searchVal: string, token?: string): Promise<OneMapResult[]> {
  const params = new URLSearchParams({ searchVal, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: '1' });
  const res = await fetch(`${SEARCH_URL}?${params}`, token ? { headers: { Authorization: token } } : undefined);
  if (!res.ok) throw new Error(`OneMap ${res.status}`);
  const body = (await res.json()) as { results?: OneMapResult[] };
  return body.results ?? [];
}

export async function geocodeBlock(key: string, token?: string): Promise<Geocode | null> {
  const { block, street } = parseBlockKey(key);
  return pickMatch(key, await search(`${block} ${expandStreet(street)}`, token));
}

/** Cache keys for postal lookups are "postal:<code>" so they share the block cache file. */
export const postalCacheKey = (postal: string) => `postal:${postal}`;

export async function geocodePostal(postal: string, token?: string): Promise<Geocode | null> {
  const hit = (await search(postal, token)).find((r) => r.POSTAL === postal);
  return hit ? { key: postalCacheKey(postal), postal, lat: Number(hit.LATITUDE), lng: Number(hit.LONGITUDE) } : null;
}
