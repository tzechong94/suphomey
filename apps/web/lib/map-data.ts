import { FLAT_TYPES, type BlockFacts, type FlatType } from '@suphomey/core';

/**
 * Wire format for GET /api/blocks: one array per field (columnar) instead of
 * one object per block. With about 10,800 blocks this cuts the payload to well
 * under half, because field names are not repeated. Medians are arrays indexed
 * by FLAT_TYPES, with 0 meaning "no data".
 */
export type MapPayload = {
  id: number[];
  lat: number[];
  lng: number[];
  label: string[];
  town: string[];
  leaseStartYear: (number | null)[];
  maxFloor: (number | null)[];
  nearestMrtM: (number | null)[];
  nearestMrtName: (string | null)[];
  nearestHawkerM: (number | null)[];
  nearestParkM: (number | null)[];
  nearestClinicM: (number | null)[];
  nearestPreschoolM: (number | null)[];
  primarySchools1km: number[];
  busStops400m: number[];
  medianRent: number[][];
  medianPrice: number[][];
  rentCount: number[][];
  priceCount: number[][];
};

export type MapBlock = BlockFacts & {
  id: number;
  lat: number;
  lng: number;
  /** "Blk 406 Ang Mo Kio Avenue 10" */
  label: string;
  town: string;
  maxFloor: number | null;
  nearestMrtName: string | null;
  /** Transactions behind each median, by flat type. */
  rentCount: Partial<Record<FlatType, number>>;
  priceCount: Partial<Record<FlatType, number>>;
};

export type MapRow = {
  id: number;
  lat: number | null;
  lng: number | null;
  label: string;
  town: string;
  leaseStartYear: number | null;
  maxFloor: number | null;
  nearestMrtM: number | null;
  nearestMrtName: string | null;
  nearestHawkerM: number | null;
  nearestParkM: number | null;
  nearestClinicM: number | null;
  nearestPreschoolM: number | null;
  primarySchools1km: number;
  busStops400m: number;
  medianRent: Record<string, number>;
  medianPrice: Record<string, number>;
  rentCounts: Record<string, number>;
  priceCounts: Record<string, number>;
};

const toArray = (medians: Record<string, number>) => FLAT_TYPES.map((t) => medians[t] ?? 0);
const toRecord = (arr: number[]) => {
  const out: Partial<Record<FlatType, number>> = {};
  FLAT_TYPES.forEach((t, i) => {
    if (arr[i]) out[t] = arr[i];
  });
  return out;
};
// 6 decimal places of a degree is about 10 cm; 5 is about 1 m, plenty for a map dot.
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

export function encodeMapPayload(rows: MapRow[]): MapPayload {
  const p: MapPayload = {
    id: [], lat: [], lng: [], label: [], town: [], leaseStartYear: [], maxFloor: [], nearestMrtM: [], nearestMrtName: [],
    nearestHawkerM: [], nearestParkM: [], nearestClinicM: [], nearestPreschoolM: [], primarySchools1km: [], busStops400m: [],
    medianRent: [], medianPrice: [], rentCount: [], priceCount: [],
  };
  for (const r of rows) {
    if (r.lat === null || r.lng === null) continue;
    p.id.push(r.id);
    p.lat.push(round5(r.lat));
    p.lng.push(round5(r.lng));
    p.label.push(r.label);
    p.town.push(r.town);
    p.leaseStartYear.push(r.leaseStartYear);
    p.maxFloor.push(r.maxFloor);
    p.nearestMrtM.push(r.nearestMrtM);
    p.nearestMrtName.push(r.nearestMrtName);
    p.nearestHawkerM.push(r.nearestHawkerM);
    p.nearestParkM.push(r.nearestParkM);
    p.nearestClinicM.push(r.nearestClinicM);
    p.nearestPreschoolM.push(r.nearestPreschoolM);
    p.primarySchools1km.push(r.primarySchools1km);
    p.busStops400m.push(r.busStops400m);
    p.medianRent.push(toArray(r.medianRent));
    p.medianPrice.push(toArray(r.medianPrice));
    p.rentCount.push(toArray(r.rentCounts));
    p.priceCount.push(toArray(r.priceCounts));
  }
  return p;
}

export function decodeMapPayload(p: MapPayload): MapBlock[] {
  return p.id.map((id, i) => ({
    id,
    lat: p.lat[i]!,
    lng: p.lng[i]!,
    label: p.label[i]!,
    town: p.town[i]!,
    leaseStartYear: p.leaseStartYear[i] ?? null,
    maxFloor: p.maxFloor[i] ?? null,
    nearestMrtM: p.nearestMrtM[i] ?? null,
    nearestMrtName: p.nearestMrtName[i] ?? null,
    nearestHawkerM: p.nearestHawkerM[i] ?? null,
    nearestParkM: p.nearestParkM[i] ?? null,
    nearestClinicM: p.nearestClinicM[i] ?? null,
    nearestPreschoolM: p.nearestPreschoolM[i] ?? null,
    primarySchools1km: p.primarySchools1km[i] ?? 0,
    busStops400m: p.busStops400m[i] ?? 0,
    medianRent: toRecord(p.medianRent[i] ?? []),
    medianPrice: toRecord(p.medianPrice[i] ?? []),
    rentCount: toRecord(p.rentCount[i] ?? []),
    priceCount: toRecord(p.priceCount[i] ?? []),
  }));
}
