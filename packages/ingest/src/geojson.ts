import type { LatLng, Polygonal } from '@suphomey/core';
import proj4 from 'proj4';

export type Feature<G = Geometry> = { properties: Record<string, unknown>; geometry: G };
export type Geometry =
  | { type: 'Point'; coordinates: number[] }
  | { type: 'LineString'; coordinates: number[][] }
  | Polygonal;
export type FeatureCollection<G = Geometry> = { features: Feature<G>[] };

/**
 * Some data.gov.sg GeoJSON files (converted from KML) keep their attributes in
 * an HTML table inside a "Description" property instead of as plain
 * properties. This returns a flat string map either way.
 */
export function props(feature: Feature<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(feature.properties)) {
    if (v !== null && v !== undefined && typeof v !== 'object') out[k] = String(v).trim();
  }
  const html = out.Description ?? out.description;
  if (html?.includes('<th>')) {
    for (const [, key, value] of html.matchAll(/<th>(.*?)<\/th>\s*<td>(.*?)<\/td>/g)) {
      out[key!] = decodeEntities(value!).trim();
    }
    delete out.Description;
    delete out.description;
  }
  return out;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** Points carry an optional third (elevation) coordinate in some files; it is ignored. */
export function pointOf(feature: Feature): LatLng | null {
  if (feature.geometry?.type !== 'Point') return null;
  const [lng, lat] = feature.geometry.coordinates;
  if (lng === undefined || lat === undefined || !Number.isFinite(lng) || !Number.isFinite(lat) || lat === 0) return null;
  return { lat, lng };
}

export function isPolygonal(g: Geometry | undefined): g is Polygonal {
  return g?.type === 'Polygon' || g?.type === 'MultiPolygon';
}

// SVY21 (EPSG:3414) is Singapore's national grid; HDB carpark coordinates use it.
const SVY21 =
  '+proj=tmerc +lat_0=1.366666666666667 +lon_0=103.8333333333333 +k=1 +x_0=28001.642 +y_0=38744.572 +ellps=WGS84 +units=m +no_defs';

export function svy21ToLatLng(x: number, y: number): LatLng {
  const [lng, lat] = proj4(SVY21, 'WGS84', [x, y]);
  return { lat: lat!, lng: lng! };
}
