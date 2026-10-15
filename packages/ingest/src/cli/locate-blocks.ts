import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { blockKey, parseBlockKey } from '@suphomey/core';
import { readCsv } from '../csv';
import { DATASETS } from '../datasets';
import { geocodeBlock } from '../geocode';
import { codeFromAnchor, findBuilding, indexBuildings, matchStreets, toBuildings, type BuildingFeature } from '../locate';
import { oneMapTokenProvider } from '../onemap-auth';
import { OneMapCache } from '../onemap-cache';
import { RAW_DIR, SEED_DIR } from '../paths';

/**
 * Writes data/seed/block-locations.csv: postal code and coordinates for every
 * HDB block in the resale, rental and property datasets. See locate.ts for the
 * method. OneMap answers are cached (see onemap-cache.ts), so reruns make no
 * repeat calls.
 */
const OUT = path.join(SEED_DIR, 'block-locations.csv');
const raw = (k: keyof typeof DATASETS) => path.join(RAW_DIR, DATASETS[k].file);

const [resale, rentals, property, buildingsGeo] = await Promise.all([
  readCsv(raw('resale')),
  readCsv(raw('rentals')),
  readCsv(raw('hdbProperty')),
  readFile(raw('hdbBuildings'), 'utf8').then((t) => JSON.parse(t) as { features: BuildingFeature[] }),
]);

const keys = new Set<string>();
for (const r of resale) keys.add(blockKey(r.block!, r.street_name!));
for (const r of rentals) keys.add(blockKey(r.block!, r.street_name!));
for (const r of property) if (r.residential === 'Y') keys.add(blockKey(r.blk_no!, r.street!));

const blocksByStreet = new Map<string, Set<string>>();
for (const key of keys) {
  const { block, street } = parseBlockKey(key);
  if (!blocksByStreet.has(street)) blocksByStreet.set(street, new Set());
  blocksByStreet.get(street)!.add(block);
}

const index = indexBuildings(toBuildings(buildingsGeo.features));
const { matched, ambiguous } = matchStreets(blocksByStreet, index);
const codeByStreet = new Map(matched.map((m) => [m.street, m.code]));
console.log(`${keys.size} blocks on ${blocksByStreet.size} streets: ${matched.length} streets matched, ${ambiguous.length} need an anchor`);

const cache = await OneMapCache.load();
const oneMapToken = oneMapTokenProvider();
const oneMap = (key: string) => cache.get(key, async () => geocodeBlock(key, await oneMapToken()));

// Resolve each ambiguous street with up to three anchor blocks.
for (const street of ambiguous) {
  for (const block of [...blocksByStreet.get(street)!].sort().slice(0, 3)) {
    const anchor = await oneMap(blockKey(block, street));
    const code = anchor && codeFromAnchor(index, block, anchor);
    if (code) {
      codeByStreet.set(street, code);
      break;
    }
  }
}
console.log(`Anchors resolved ${codeByStreet.size - matched.length}/${ambiguous.length} streets (${cache.calls} OneMap calls)`);

const rows: string[] = ['key,postal,lat,lng,source'];
let footprint = 0;
let geocoded = 0;
const missing: string[] = [];
for (const key of [...keys].sort()) {
  const { block, street } = parseBlockKey(key);
  const code = codeByStreet.get(street);
  const building = code ? findBuilding(index, code, block) : undefined;
  if (building) {
    footprint++;
    rows.push(`${key},${building.postal},${building.centre.lat.toFixed(6)},${building.centre.lng.toFixed(6)},footprint`);
    continue;
  }
  // New blocks may not be in the footprint dataset yet: geocode them individually.
  const g = await oneMap(key);
  if (g) {
    geocoded++;
    rows.push(`${key},${g.postal},${g.lat.toFixed(6)},${g.lng.toFixed(6)},onemap`);
  } else {
    missing.push(key);
  }
}
await writeFile(OUT, rows.join('\n') + '\n');
console.log(`Located ${footprint} from footprints, ${geocoded} via OneMap, ${missing.length} missing`);
if (missing.length) console.log(`Missing: ${missing.join('; ')}`);
