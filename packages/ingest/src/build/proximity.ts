import { AMENITY_KINDS, type AmenityKind, type LatLng } from '@suphomey/core';
import type { Amenity, CountedPoint } from '../parse/amenities';
import { PointIndex } from '../spatial';

export type LocatedBlock = LatLng & { key: string };

export type BlockAmenityRow = { key: string; kind: AmenityKind; sourceId: string; distanceM: number };

export type ProximitySummary = {
  key: string;
  nearestMrtM: number | null;
  nearestMrtName: string | null;
  nearestHawkerM: number | null;
  nearestPrimarySchoolM: number | null;
  nearestParkM: number | null;
  nearestClinicM: number | null;
  nearestPreschoolM: number | null;
  busStops400m: number;
  hawkers1km: number;
  primarySchools1km: number;
  primarySchools2km: number;
  playgrounds500m: number;
  fitnessCorners500m: number;
  preschools1km: number;
  clinics1km: number;
};

type ParkEdge = LatLng & { sourceId: string };

export function computeProximity(
  blocks: LocatedBlock[],
  amenities: Amenity[],
  parkEdges: ParkEdge[],
  counted: CountedPoint[],
): { rows: BlockAmenityRow[]; summaries: ProximitySummary[] } {
  const byKind = new Map<AmenityKind, PointIndex<Amenity>>();
  for (const kind of Object.keys(AMENITY_KINDS) as AmenityKind[]) {
    if (kind === 'park') continue;
    byKind.set(kind, new PointIndex(amenities.filter((a) => a.kind === kind)));
  }
  const parkEdgeIndex = new PointIndex(parkEdges);
  const countIndex = {
    bus_stop: new PointIndex(counted.filter((c) => c.kind === 'bus_stop')),
    playground: new PointIndex(counted.filter((c) => c.kind === 'playground')),
    fitness_corner: new PointIndex(counted.filter((c) => c.kind === 'fitness_corner')),
  };

  const rows: BlockAmenityRow[] = [];
  const summaries: ProximitySummary[] = [];

  for (const block of blocks) {
    const within = (kind: AmenityKind, radiusM: number) => byKind.get(kind)!.within(block, radiusM);
    const nearest = (kind: AmenityKind) => byKind.get(kind)!.nearest(block);

    for (const kind of byKind.keys()) {
      let hits = within(kind, AMENITY_KINDS[kind].radiusM);
      // A station has many exits; listing all of them is noise. Keep the nearest exit per station.
      if (kind === 'mrt_exit') {
        const seen = new Set<string>();
        hits = hits.filter((h) => !seen.has(h.item.name) && seen.add(h.item.name));
      }
      for (const h of hits.slice(0, AMENITY_KINDS[kind].maxListed)) rows.push({ key: block.key, kind, sourceId: h.item.sourceId, distanceM: h.distanceM });
    }

    // Parks: distance to the nearest point on the outline, one row per park.
    const parkHits = new Map<string, number>();
    for (const h of parkEdgeIndex.within(block, AMENITY_KINDS.park.radiusM)) {
      if (!parkHits.has(h.item.sourceId)) parkHits.set(h.item.sourceId, h.distanceM);
    }
    for (const [sourceId, distanceM] of [...parkHits].slice(0, AMENITY_KINDS.park.maxListed)) rows.push({ key: block.key, kind: 'park', sourceId, distanceM });

    const mrt = nearest('mrt_exit');
    // Counts use fixed radii, independent of how many places are listed.
    const primary = within('primary_school', 2000);
    summaries.push({
      key: block.key,
      nearestMrtM: mrt?.distanceM ?? null,
      nearestMrtName: mrt?.item.name ?? null,
      nearestHawkerM: nearest('hawker')?.distanceM ?? null,
      nearestPrimarySchoolM: nearest('primary_school')?.distanceM ?? null,
      nearestParkM: parkEdgeIndex.nearest(block)?.distanceM ?? null,
      nearestClinicM: nearest('clinic')?.distanceM ?? null,
      nearestPreschoolM: nearest('preschool')?.distanceM ?? null,
      busStops400m: countIndex.bus_stop.within(block, 400).length,
      hawkers1km: within('hawker', 1000).length,
      primarySchools1km: primary.filter((h) => h.distanceM <= 1000).length,
      primarySchools2km: primary.length,
      playgrounds500m: countIndex.playground.within(block, 500).length,
      fitnessCorners500m: countIndex.fitness_corner.within(block, 500).length,
      preschools1km: within('preschool', 1000).length,
      clinics1km: within('clinic', 1000).length,
    });
  }
  return { rows, summaries };
}
