import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseBlockKey, sgDate, type LatLng } from '@suphomey/core';
import { computeLandUse, computeProgrammes, planningAreaOf } from '../build/areas';
import { computeProximity, type LocatedBlock } from '../build/proximity';
import { readCsv } from '../csv';
import { DATASETS, type DatasetKey } from '../datasets';
import type { FeatureCollection } from '../geojson';
import { geocodePostal, postalCacheKey } from '../geocode';
import { toBuildings, type BuildingFeature } from '../locate';
import { oneMapTokenProvider } from '../onemap-auth';
import { OneMapCache } from '../onemap-cache';
import {
  parseCarparks,
  parseClinics,
  parseCountedPoints,
  parseHawkers,
  parseMrtExits,
  parseNamedPoints,
  parseParks,
  parsePreschools,
  parseSchools,
  parseStudentCare,
  type Amenity,
} from '../parse/amenities';
import { parseLandUse, parsePlanningAreas, parseProgrammes, parseRiskAreas } from '../parse/areas';
import { parseHdbProperty } from '../parse/blocks';
import { parseBtoPrices, parseMedianRent, parseResaleIndex } from '../parse/stats';
import { parseRentals, parseResale } from '../parse/transactions';
import { RAW_DIR, SEED_DIR } from '../paths';
import { PolygonIndex } from '../spatial';
import { toBlockAmenityTuple, toLandUseTuple, toRentalTuple, toResaleTuple, writeSeed, type BlockSeed } from '../seed-files';

/**
 * Turns the raw downloads in data/raw into the committed snapshot in data/seed.
 * Run `pnpm download` and `pnpm locate-blocks` first.
 */
const raw = (k: DatasetKey) => path.join(RAW_DIR, DATASETS[k].file);
const csv = (k: DatasetKey) => readCsv(raw(k));
const geo = async <T = FeatureCollection>(k: DatasetKey) => JSON.parse(await readFile(raw(k), 'utf8')) as T;
const time = async <T>(label: string, fn: () => Promise<T> | T): Promise<T> => {
  const start = Date.now();
  const out = await fn();
  console.log(`${label}: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  return out;
};

// ---- Transactions and blocks -------------------------------------------------
const resale = parseResale(await csv('resale'));
const rentals = parseRentals(await csv('rentals'));
for (const [name, p] of [['resale', resale], ['rentals', rentals]] as const) {
  if (p.rejected.length) console.warn(`${name}: ${p.rejected.length} rows rejected, e.g. ${JSON.stringify(p.rejected[0])}`);
}
const property = new Map(parseHdbProperty(await csv('hdbProperty')).map((p) => [p.key, p]));

const locations = new Map<string, { postal: string; lat: number; lng: number }>();
for (const line of (await readFile(path.join(SEED_DIR, 'block-locations.csv'), 'utf8')).split('\n').slice(1)) {
  const [key, postal, lat, lng] = line.split(',');
  if (key && lat) locations.set(key, { postal: postal!, lat: Number(lat), lng: Number(lng) });
}

// Latest town and the most common lease start year per block, from transactions.
const townByKey = new Map<string, string>();
const leaseYears = new Map<string, Map<number, number>>();
for (const r of [...rentals.records, ...resale.records].sort((a, b) => a.month.localeCompare(b.month))) townByKey.set(r.key, r.town);
for (const r of resale.records) {
  const counts = leaseYears.get(r.key) ?? new Map<number, number>();
  counts.set(r.leaseStartYear, (counts.get(r.leaseStartYear) ?? 0) + 1);
  leaseYears.set(r.key, counts);
}
const mode = (m: Map<number, number> | undefined) => (m ? [...m].sort((a, b) => b[1] - a[1])[0]![0] : null);

const planningAreas = new PolygonIndex(parsePlanningAreas(await geo('planningAreas')));
const keys = new Set([...townByKey.keys(), ...property.keys()]);
const blocks: BlockSeed[] = [...keys].sort().map((key) => {
  const { block, street } = parseBlockKey(key);
  const attrs = property.get(key);
  const loc = locations.get(key);
  return {
    key,
    block,
    street,
    town: townByKey.get(key) ?? attrs?.town ?? 'UNKNOWN',
    postal: loc?.postal && loc.postal !== 'NIL' ? loc.postal : null,
    lat: loc?.lat ?? null,
    lng: loc?.lng ?? null,
    planningArea: loc ? planningAreaOf(planningAreas, loc) : null,
    yearCompleted: attrs?.yearCompleted ?? null,
    leaseStartYear: mode(leaseYears.get(key)) ?? attrs?.yearCompleted ?? null,
    maxFloor: attrs?.maxFloor ?? null,
    totalUnits: attrs?.totalUnits ?? null,
    hasMarketHawker: attrs?.hasMarketHawker ?? false,
    hasCarpark: attrs?.hasCarpark ?? false,
    hasCommercial: attrs?.hasCommercial ?? false,
    unitMix: attrs?.unitMix ?? {},
  };
});
const located: LocatedBlock[] = blocks.flatMap((b) => (b.lat !== null && b.lng !== null ? [{ key: b.key, lat: b.lat, lng: b.lng }] : []));
console.log(`blocks: ${blocks.length} (${located.length} located)`);

// ---- Amenities ---------------------------------------------------------------
const buildings = toBuildings((await geo<{ features: BuildingFeature[] }>('hdbBuildings')).features);
const byPostal = new Map<string, LatLng>(buildings.map((b) => [b.postal, b.centre]));

const cache = await OneMapCache.load();
const oneMapToken = oneMapTokenProvider();
const schools: Amenity[] = [];
let schoolMisses = 0;
for (const s of parseSchools(await csv('schools'), await csv('schoolProgrammes'))) {
  const hit = await cache.get(postalCacheKey(s.postal), async () => geocodePostal(s.postal, await oneMapToken()));
  if (hit) schools.push({ ...s, lat: hit.lat, lng: hit.lng });
  else schoolMisses++;
}
console.log(`schools: ${schools.length} placed, ${schoolMisses} not found (${cache.calls} OneMap calls)`);

const thisMonth = sgDate().slice(0, 7);
const [preschoolCentres, preschoolLocations] = [await csv('preschoolCentres'), await geo('preschoolLocations')];
// Centres in neither ECDA's location layer nor an HDB footprint are looked up on OneMap by postal code.
const unplacedPostals = new Set<string>();
parsePreschools(preschoolCentres, preschoolLocations, (p) => byPostal.get(p) ?? void unplacedPostals.add(p), thisMonth);
const byOneMapPostal = new Map<string, LatLng>();
for (const postal of unplacedPostals) {
  if (!/^\d{6}$/.test(postal) || postal === '000000') continue;
  const hit = await cache.get(postalCacheKey(postal), async () => geocodePostal(postal, await oneMapToken()));
  if (hit) byOneMapPostal.set(postal, hit);
}
const preschools = parsePreschools(preschoolCentres, preschoolLocations, (p) => byPostal.get(p) ?? byOneMapPostal.get(p), thisMonth);
console.log(`preschools: ${preschools.amenities.length} placed, ${preschools.unplaced} without a location`);

const parks = parseParks(await geo('parks'));
const amenities: Amenity[] = [
  ...parseMrtExits(await geo('mrtExits')),
  ...parseHawkers(await csv('hawkerClosures')),
  ...schools,
  ...preschools.amenities,
  ...parseStudentCare(await geo('studentCare')),
  ...parseClinics(await geo('clinics')),
  ...parseNamedPoints(await geo('pharmacies'), 'pharmacy', 'PHARMACY_NAME'),
  ...parseNamedPoints(await geo('eldercare'), 'eldercare', 'NAME'),
  ...parseNamedPoints(await geo('libraries'), 'library', 'NAME'),
  ...parseNamedPoints(await geo('communityClubs'), 'community_club', 'NAME'),
  ...parseNamedPoints(await geo('sportCentres'), 'sport_centre', 'VENUE'),
  ...parks.amenities,
  ...parseCarparks(await csv('hdbCarparks')),
];
// Some layers list the same place twice; the database enforces (kind, sourceId) uniqueness.
const uniqueAmenities = [...new Map(amenities.map((a) => [`${a.kind}|${a.sourceId}`, a])).values()];
const counted = parseCountedPoints(await geo('busStops'), await geo('parkFacilities'));

const proximity = await time('proximity', () => computeProximity(located, uniqueAmenities, parks.edges, counted));
console.log(`block_amenities: ${proximity.rows.length} rows`);

// ---- Areas -------------------------------------------------------------------
const zones = await time('load Master Plan', async () => parseLandUse(await geo('landUse')));
const landUse = await time('land use', () => computeLandUse(located, zones));
const programmes = computeProgrammes(located, [
  ...parseProgrammes(await geo('liftUpgrading'), 'LUP'),
  ...parseProgrammes(await geo('neighbourhoodRenewal'), 'NRP'),
]);
const riskAreas = parseRiskAreas(await geo('dengueClusters'), await geo('aedesAreas'));
const townStats = [
  ...parseMedianRent(await csv('medianRent')),
  ...parseBtoPrices(await csv('btoPrices')),
  ...parseResaleIndex(await csv('resaleIndex')),
];

// ---- Write -------------------------------------------------------------------
const sizes = {
  blocks: await writeSeed('blocks', blocks),
  summaries: await writeSeed('summaries', proximity.summaries),
  amenities: await writeSeed('amenities', uniqueAmenities),
  blockAmenities: await writeSeed('blockAmenities', proximity.rows.map(toBlockAmenityTuple)),
  landUse: await writeSeed('landUse', landUse.map(toLandUseTuple)),
  programmes: await writeSeed('programmes', programmes),
  riskAreas: await writeSeed('riskAreas', riskAreas),
  townStats: await writeSeed('townStats', townStats),
  resale: await writeSeed('resale', resale.records.map(toResaleTuple)),
  rentals: await writeSeed('rentals', rentals.records.map(toRentalTuple)),
};
for (const [name, bytes] of Object.entries(sizes)) console.log(`data/seed/${name}.json.gz ${(bytes / 1e6).toFixed(2)} MB`);
