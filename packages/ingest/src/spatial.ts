import { contains, distanceM, type LatLng, type Polygonal } from '@suphomey/core';
import Flatbush from 'flatbush';
import { around } from 'geokdbush';
import KDBush from 'kdbush';

/** k-d tree over points for fast "what is near here" queries. */
export class PointIndex<T extends LatLng> {
  private readonly index: KDBush;

  constructor(readonly items: T[]) {
    this.index = new KDBush(Math.max(items.length, 1));
    for (const p of items) this.index.add(p.lng, p.lat);
    if (items.length === 0) this.index.add(0, 0);
    this.index.finish();
  }

  /** Items within radiusM of the point, nearest first, with their distance. */
  within(point: LatLng, radiusM: number): { item: T; distanceM: number }[] {
    if (this.items.length === 0) return [];
    return around(this.index, point.lng, point.lat, Infinity, radiusM / 1000).map((i) => {
      const item = this.items[i]!;
      return { item, distanceM: Math.round(distanceM(point, item)) };
    });
  }

  nearest(point: LatLng): { item: T; distanceM: number } | null {
    if (this.items.length === 0) return null;
    const [i] = around(this.index, point.lng, point.lat, 1);
    const item = this.items[i!]!;
    return { item, distanceM: Math.round(distanceM(point, item)) };
  }
}

/** Bounding-box index over polygons, followed by an exact point-in-polygon test. */
export class PolygonIndex<T extends { geometry: Polygonal }> {
  private readonly index: Flatbush;

  constructor(readonly items: T[]) {
    this.index = new Flatbush(Math.max(items.length, 1));
    for (const item of items) {
      const [minX, minY, maxX, maxY] = bbox(item.geometry);
      this.index.add(minX, minY, maxX, maxY);
    }
    if (items.length === 0) this.index.add(0, 0, 0, 0);
    this.index.finish();
  }

  containing(point: LatLng): T[] {
    if (this.items.length === 0) return [];
    return this.index
      .search(point.lng, point.lat, point.lng, point.lat)
      .map((i) => this.items[i]!)
      .filter((item) => contains(item.geometry, point));
  }
}

function bbox(geom: Polygonal): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const rings = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x! < minX) minX = x!;
      if (y! < minY) minY = y!;
      if (x! > maxX) maxX = x!;
      if (y! > maxY) maxY = y!;
    }
  }
  return [minX, minY, maxX, maxY];
}

/**
 * Points on a square grid covering a circle, used to estimate how much of each
 * land-use zone lies within a radius: each point stands for stepM x stepM of ground.
 */
export function gridAround(centre: LatLng, radiusM: number, stepM: number): LatLng[] {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((centre.lat * Math.PI) / 180);
  const points: LatLng[] = [];
  for (let dy = -radiusM; dy <= radiusM; dy += stepM) {
    for (let dx = -radiusM; dx <= radiusM; dx += stepM) {
      if (dx * dx + dy * dy > radiusM * radiusM) continue;
      points.push({ lat: centre.lat + dy / mPerDegLat, lng: centre.lng + dx / mPerDegLng });
    }
  }
  return points;
}
