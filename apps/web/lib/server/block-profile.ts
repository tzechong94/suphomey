import 'server-only';
import { AMENITY_KINDS, contains, remainingLeaseYears, type AmenityKind, type Polygonal } from '@suphomey/core';
import { getBlock, getRiskAreas, type Db } from '@suphomey/db';
import { blockLabel } from '../format';

export type NearbyPlace = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  distanceM: number;
  details: Record<string, unknown>;
};

/** The block page's data, assembled from the block, its precomputed neighbours and live risk areas. */
export async function getBlockProfile(db: Db, id: number, asOf = new Date()) {
  const [block, risks] = await Promise.all([getBlock(db, id), getRiskAreas(db)]);
  if (!block) return null;

  const nearby: Partial<Record<AmenityKind, NearbyPlace[]>> = {};
  for (const n of block.nearby) {
    const kind = n.kind as AmenityKind;
    if (!(kind in AMENITY_KINDS)) continue;
    (nearby[kind] ??= []).push({ id: n.id, name: n.name, lat: n.lat, lng: n.lng, distanceM: n.distanceM, details: n.details });
  }

  const point = block.lat !== null && block.lng !== null ? { lat: block.lat, lng: block.lng } : null;
  const insideRisk = point ? risks.filter((r) => contains(r.geometry as Polygonal, point)) : [];

  const totalLandUse = block.landUse.reduce((sum, l) => sum + l.areaM2, 0);
  const s = block.summary;

  return {
    id: block.id,
    label: blockLabel(block.block, block.street),
    block: block.block,
    street: block.street,
    town: block.town,
    postal: block.postal,
    lat: block.lat,
    lng: block.lng,
    planningArea: block.planningArea,
    yearCompleted: block.yearCompleted,
    leaseStartYear: block.leaseStartYear,
    remainingLeaseYears: block.leaseStartYear === null ? null : remainingLeaseYears(block.leaseStartYear, asOf),
    maxFloor: block.maxFloor,
    totalUnits: block.totalUnits,
    hasMarketHawker: block.hasMarketHawker,
    hasCarpark: block.hasCarpark,
    hasCommercial: block.hasCommercial,
    unitMix: block.unitMix,
    summary: s && {
      nearestMrtM: s.nearestMrtM,
      nearestMrtName: s.nearestMrtName,
      nearestHawkerM: s.nearestHawkerM,
      nearestPrimarySchoolM: s.nearestPrimarySchoolM,
      nearestParkM: s.nearestParkM,
      nearestClinicM: s.nearestClinicM,
      nearestPreschoolM: s.nearestPreschoolM,
      busStops400m: s.busStops400m,
      hawkers1km: s.hawkers1km,
      primarySchools1km: s.primarySchools1km,
      primarySchools2km: s.primarySchools2km,
      playgrounds500m: s.playgrounds500m,
      fitnessCorners500m: s.fitnessCorners500m,
      preschools1km: s.preschools1km,
      clinics1km: s.clinics1km,
      medianRent: s.medianRent,
      medianPrice: s.medianPrice,
      rentCounts: s.rentCounts,
      priceCounts: s.priceCounts,
      rentals12m: s.rentals12m,
      resales12m: s.resales12m,
    },
    nearby,
    landUse: block.landUse.map((l) => ({ ...l, share: totalLandUse ? Math.round((l.areaM2 / totalLandUse) * 1000) / 1000 : 0 })),
    programmes: block.programmes.map(({ programme, name, status, estimatedCompletion }) => ({ programme, name, status, estimatedCompletion })),
    risks: insideRisk.map((r) => ({ kind: r.kind, name: r.name, caseCount: r.caseCount, updatedAt: r.updatedAt })),
  };
}

export type BlockProfile = NonNullable<Awaited<ReturnType<typeof getBlockProfile>>>;
