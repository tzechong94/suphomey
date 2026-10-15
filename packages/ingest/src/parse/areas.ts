import type { Polygonal } from '@suphomey/core';
import { toNumber } from '../csv';
import { isPolygonal, props, type FeatureCollection } from '../geojson';

export type ProgrammeArea = {
  programme: 'LUP' | 'NRP';
  name: string;
  status: string | null;
  estimatedCompletion: string | null;
  geometry: Polygonal;
};

/** HDB uses "4Q 2999" as a placeholder for "no date yet". */
const realQuarter = (q: string | undefined) => (q && !q.endsWith('2999') && q !== 'None' ? q : null);

export function parseProgrammes(fc: FeatureCollection, programme: ProgrammeArea['programme']): ProgrammeArea[] {
  return fc.features.flatMap((f) => {
    if (!isPolygonal(f.geometry)) return [];
    const p = props(f);
    return [
      {
        programme,
        // "BISHAN STREET 22(BIS27)" -> "Bishan Street 22"
        name: (p.NAME ?? programme).replace(/\s*\([^)]*\)\s*$/, ''),
        status: p.STATUS === 'U/C' ? 'Under construction' : (p.STATUS ?? null),
        estimatedCompletion: realQuarter(p.ESTMT_CNSTRN_CMPLTN),
        geometry: f.geometry,
      },
    ];
  });
}

export type RiskArea = { kind: 'dengue' | 'aedes'; name: string; caseCount: number | null; geometry: Polygonal };

export function parseRiskAreas(dengue: FeatureCollection, aedes: FeatureCollection): RiskArea[] {
  const areas: RiskArea[] = [];
  for (const f of dengue.features) {
    if (!isPolygonal(f.geometry)) continue;
    const p = props(f);
    areas.push({ kind: 'dengue', name: p.LOCALITY ?? 'Dengue cluster', caseCount: toNumber(p.CASE_SIZE), geometry: f.geometry });
  }
  for (const f of aedes.features) {
    if (!isPolygonal(f.geometry)) continue;
    const p = props(f);
    // DESCRIPTION looks like "CO341 - Aroozoo Ave / Jln Lepas / ..."
    const name = (p.DESCRIPTION ?? '').replace(/^\w+\s*-\s*/, '') || 'High Aedes population area';
    areas.push({ kind: 'aedes', name, caseCount: null, geometry: f.geometry });
  }
  return areas;
}

export type NamedArea = { name: string; geometry: Polygonal };

export function parsePlanningAreas(fc: FeatureCollection): NamedArea[] {
  return fc.features.flatMap((f) => (isPolygonal(f.geometry) ? [{ name: props(f).PLN_AREA_N ?? '', geometry: f.geometry }] : []));
}

/** Master Plan zones that say something about a neighbourhood's future. Roads are everywhere and say nothing. */
export const IGNORED_LAND_USE = new Set(['ROAD']);

export function parseLandUse(fc: FeatureCollection): NamedArea[] {
  return fc.features.flatMap((f) => {
    const name = props(f).LU_DESC;
    return isPolygonal(f.geometry) && name && !IGNORED_LAND_USE.has(name) ? [{ name, geometry: f.geometry }] : [];
  });
}
