import type { LatLng } from '@suphomey/core';
import type { NamedArea, ProgrammeArea } from '../parse/areas';
import { gridAround, PolygonIndex } from '../spatial';
import type { LocatedBlock } from './proximity';

export const LAND_USE_RADIUS_M = 500;
const GRID_STEP_M = 50;

export type LandUseRow = { key: string; landUse: string; areaM2: number };

/**
 * Estimates the area of each Master Plan zone within 500 m of a block by
 * sampling a 50 m grid (about 315 points) and asking which zone each point is
 * in. Each point stands for 2,500 m². This avoids exact polygon clipping, which
 * is costly and needs a geometry library, and is accurate to roughly one grid
 * cell per zone boundary.
 */
export function computeLandUse(blocks: LocatedBlock[], zones: NamedArea[]): LandUseRow[] {
  const index = new PolygonIndex(zones);
  const rows: LandUseRow[] = [];
  for (const block of blocks) {
    const counts = new Map<string, number>();
    for (const point of gridAround(block, LAND_USE_RADIUS_M, GRID_STEP_M)) {
      const zone = index.containing(point)[0];
      if (zone) counts.set(zone.name, (counts.get(zone.name) ?? 0) + 1);
    }
    for (const [landUse, n] of counts) rows.push({ key: block.key, landUse, areaM2: n * GRID_STEP_M * GRID_STEP_M });
  }
  return rows;
}

export type ProgrammeRow = { key: string; programme: string; name: string; status: string | null; estimatedCompletion: string | null };

export function computeProgrammes(blocks: LocatedBlock[], areas: ProgrammeArea[]): ProgrammeRow[] {
  const index = new PolygonIndex(areas);
  return blocks.flatMap((block) =>
    index.containing(block).map((a) => ({
      key: block.key,
      programme: a.programme,
      name: a.name,
      status: a.status,
      estimatedCompletion: a.estimatedCompletion,
    })),
  );
}

export function planningAreaOf(index: PolygonIndex<NamedArea>, point: LatLng): string | null {
  return index.containing(point)[0]?.name ?? null;
}
