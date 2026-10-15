export type LatLng = { lat: number; lng: number };

/** [lng, lat] positions, as in GeoJSON. */
export type Ring = number[][];
export type Polygonal =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] };

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Mean of a ring's vertices. Good enough for building footprints, which are small and compact. */
export function ringCentroid(ring: Ring): LatLng {
  // GeoJSON rings repeat the first vertex at the end; skip it so it is not double counted.
  const pts = ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
  let lat = 0;
  let lng = 0;
  for (const p of pts) {
    lng += p[0]!;
    lat += p[1]!;
  }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

/** Outer ring of a polygon, or of the first part of a multipolygon. */
export function outerRing(geom: Polygonal): Ring {
  return geom.type === 'Polygon' ? geom.coordinates[0]! : geom.coordinates[0]![0]!;
}

function inRing(point: LatLng, ring: Ring): boolean {
  // Ray casting: count how many edges a ray going east from the point crosses.
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const crosses = yi! > point.lat !== yj! > point.lat && point.lng < ((xj! - xi!) * (point.lat - yi!)) / (yj! - yi!) + xi!;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Point in polygon, honouring holes (rings after the first). */
export function contains(geom: Polygonal, point: LatLng): boolean {
  const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polygons.some(
    ([outer, ...holes]) => outer !== undefined && inRing(point, outer) && !holes.some((h) => inRing(point, h)),
  );
}
