import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { AmenityKind } from '@suphomey/core';
import type { BlockAmenityRow, ProximitySummary } from './build/proximity';
import type { LandUseRow, ProgrammeRow } from './build/areas';
import type { Amenity } from './parse/amenities';
import type { RiskArea } from './parse/areas';
import type { TownStat } from './parse/stats';
import type { RentalRecord, ResaleRecord } from './parse/transactions';
import { SEED_DIR } from './paths';

export type BlockSeed = {
  key: string;
  block: string;
  street: string;
  town: string;
  postal: string | null;
  lat: number | null;
  lng: number | null;
  planningArea: string | null;
  yearCompleted: number | null;
  leaseStartYear: number | null;
  maxFloor: number | null;
  totalUnits: number | null;
  hasMarketHawker: boolean;
  hasCarpark: boolean;
  hasCommercial: boolean;
  unitMix: Record<string, number>;
};

/**
 * The committed snapshot. Each table is a gzipped JSON array. Large tables are
 * stored as tuples rather than objects, which roughly halves their size.
 */
export type SeedFiles = {
  blocks: BlockSeed[];
  summaries: ProximitySummary[];
  amenities: Amenity[];
  blockAmenities: [key: string, kind: AmenityKind, sourceId: string, distanceM: number][];
  landUse: [key: string, landUse: string, areaM2: number][];
  programmes: ProgrammeRow[];
  riskAreas: RiskArea[];
  townStats: TownStat[];
  resale: [key: string, month: string, flatType: string, storeyLow: number, storeyHigh: number, floorAreaSqm: number, flatModel: string, leaseStartYear: number, price: number][];
  rentals: [key: string, month: string, flatType: string, rent: number][];
};

const file = (name: keyof SeedFiles) => path.join(SEED_DIR, `${name}.json.gz`);

export async function writeSeed<K extends keyof SeedFiles>(name: K, data: SeedFiles[K]): Promise<number> {
  const buf = gzipSync(JSON.stringify(data), { level: 9 });
  await writeFile(file(name), buf);
  return buf.length;
}

export async function readSeed<K extends keyof SeedFiles>(name: K): Promise<SeedFiles[K]> {
  return JSON.parse(gunzipSync(await readFile(file(name))).toString('utf8')) as SeedFiles[K];
}

export const toBlockAmenityTuple = (r: BlockAmenityRow): SeedFiles['blockAmenities'][number] => [r.key, r.kind, r.sourceId, r.distanceM];
export const toLandUseTuple = (r: LandUseRow): SeedFiles['landUse'][number] => [r.key, r.landUse, r.areaM2];
export const toResaleTuple = (r: ResaleRecord): SeedFiles['resale'][number] => [
  r.key, r.month, r.flatType, r.storeyLow, r.storeyHigh, r.floorAreaSqm, r.flatModel, r.leaseStartYear, r.price,
];
export const toRentalTuple = (r: RentalRecord): SeedFiles['rentals'][number] => [r.key, r.month, r.flatType, r.rent];
