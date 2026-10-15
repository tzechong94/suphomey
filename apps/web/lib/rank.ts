import { scoreBlock, type MatchResult } from '@suphomey/core';
import { budgetOf, type SearchState } from './client/preferences';
import type { MapBlock } from './map-data';

export type Ranked = { block: MapBlock; match: MatchResult };
export type SortKey = 'match' | 'cheapest';

/** A median based on fewer transactions than this is shown, but not trusted for "cheapest" sorting. */
export const MIN_TRUSTED_COUNT = 3;

/**
 * Scores every block against the current search and orders the ones that pass
 * all must-haves. Ties on match % go to the block with more transactions behind
 * its typical price, then the cheaper one. "Cheapest first" only ranks blocks
 * whose typical price is backed by enough transactions, because a single odd
 * rental (e.g. a family arrangement at half the market rate) would otherwise
 * float to the top.
 */
export function rankBlocks(blocks: MapBlock[], state: SearchState, sort: SortKey = 'match', asOf = new Date()) {
  const ctx = { budget: budgetOf(state), asOf };
  const all: Ranked[] = blocks.map((block) => ({ block, match: scoreBlock(block, state.prefs, ctx) }));
  const countOf = (b: MapBlock) => (state.mode === 'rent' ? b.rentCount : b.priceCount)[state.flatType] ?? 0;
  const priceOf = (b: MapBlock) => (state.mode === 'rent' ? b.medianRent : b.medianPrice)[state.flatType] ?? Infinity;
  const trustedPrice = (b: MapBlock) => (countOf(b) >= MIN_TRUSTED_COUNT ? priceOf(b) : Infinity);
  const passing = all.filter((r) => r.match.passes);
  passing.sort((a, b) => {
    if (sort === 'cheapest') return trustedPrice(a.block) - trustedPrice(b.block) || b.match.percent - a.match.percent || a.block.id - b.block.id;
    return b.match.percent - a.match.percent || countOf(b.block) - countOf(a.block) || priceOf(a.block) - priceOf(b.block) || a.block.id - b.block.id;
  });
  return { all, passing };
}
