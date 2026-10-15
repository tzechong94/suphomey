import { distanceM, outerRing, ringCentroid, type LatLng, type Polygonal } from '@suphomey/core';

/**
 * Locating HDB blocks without geocoding each one.
 *
 * Resale and rental rows identify a block by number + street name but carry no
 * coordinates. The "HDB Existing Building" dataset has a footprint and postal
 * code for every block, but identifies the street only by an opaque code
 * (ST_COD). This module learns the street name -> street code mapping from the
 * data itself: a street's set of block numbers is close to a fingerprint, so the
 * code whose block numbers overlap most (Jaccard similarity) is the match.
 *
 * Matches are only trusted when they are clear winners and the matched
 * buildings sit close together. Everything else is resolved with one OneMap
 * lookup per street (an "anchor"), not one per block.
 */

export type Building = { streetCode: string; block: string; postal: string; centre: LatLng };

export type BuildingFeature = {
  properties: { ST_COD: string; BLK_NO: string; POSTAL_COD: string };
  geometry: Polygonal;
};

export function toBuildings(features: BuildingFeature[]): Building[] {
  return features.map((f) => ({
    streetCode: f.properties.ST_COD,
    block: f.properties.BLK_NO.trim().toUpperCase(),
    postal: f.properties.POSTAL_COD,
    centre: ringCentroid(outerRing(f.geometry)),
  }));
}

export type BuildingIndex = {
  blocksByCode: Map<string, Set<string>>;
  byCodeAndBlock: Map<string, Building>;
};

const codeBlock = (code: string, block: string) => `${code}#${block}`;

export function indexBuildings(buildings: Building[]): BuildingIndex {
  const blocksByCode = new Map<string, Set<string>>();
  const byCodeAndBlock = new Map<string, Building>();
  for (const b of buildings) {
    if (!blocksByCode.has(b.streetCode)) blocksByCode.set(b.streetCode, new Set());
    blocksByCode.get(b.streetCode)!.add(b.block);
    byCodeAndBlock.set(codeBlock(b.streetCode, b.block), b);
  }
  return { blocksByCode, byCodeAndBlock };
}

export function findBuilding(index: BuildingIndex, code: string, block: string): Building | undefined {
  return index.byCodeAndBlock.get(codeBlock(code, block));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

export const MATCH_RULES = {
  /** Minimum Jaccard similarity for the best code. */
  minScore: 0.5,
  /** Best code must beat the runner-up by this much. */
  minMargin: 0.2,
  /** Every matched building must lie within this distance of the street's median point. */
  maxSpreadM: 3000,
};

export type StreetMatch = { street: string; code: string; score: number };

/** Returns confident matches, and the streets that need an anchor lookup. */
export function matchStreets(
  blocksByStreet: Map<string, Set<string>>,
  index: BuildingIndex,
): { matched: StreetMatch[]; ambiguous: string[] } {
  const matched: StreetMatch[] = [];
  const ambiguous: string[] = [];
  for (const [street, blocks] of blocksByStreet) {
    const scores = [...index.blocksByCode]
      .map(([code, codeBlocks]) => ({ code, score: jaccard(blocks, codeBlocks) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    const [best, runnerUp] = scores;
    const clearWinner =
      best !== undefined &&
      best.score >= MATCH_RULES.minScore &&
      (runnerUp === undefined || best.score - runnerUp.score >= MATCH_RULES.minMargin);
    if (clearWinner && isCompact(index, best.code, blocks)) matched.push({ street, ...best });
    else ambiguous.push(street);
  }
  return { matched, ambiguous };
}

function isCompact(index: BuildingIndex, code: string, blocks: Set<string>): boolean {
  const points = [...blocks].flatMap((b) => findBuilding(index, code, b)?.centre ?? []);
  if (points.length === 0) return false;
  const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const centre = { lat: median(points.map((p) => p.lat)), lng: median(points.map((p) => p.lng)) };
  return points.every((p) => distanceM(p, centre) <= MATCH_RULES.maxSpreadM);
}

/**
 * Given a geocoded anchor block on an ambiguous street, the right street code is
 * the one whose building with that block number is next to the anchor point.
 */
export function codeFromAnchor(
  index: BuildingIndex,
  block: string,
  anchor: LatLng,
  maxDistanceM = 150,
): string | null {
  let best: { code: string; d: number } | null = null;
  for (const code of index.blocksByCode.keys()) {
    const building = findBuilding(index, code, block);
    if (!building) continue;
    const d = distanceM(building.centre, anchor);
    if (d <= maxDistanceM && (!best || d < best.d)) best = { code, d };
  }
  return best?.code ?? null;
}
