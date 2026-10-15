'use client';

import { remainingLeaseYears, type MatchResult } from '@suphomey/core';
import { Heart, Scale } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { SearchState } from '@/lib/client/preferences';
import { useSavedList } from '@/lib/client/saved';
import { distance, flatTypeLabel, money, moneyShort, titleCase } from '@/lib/format';
import type { MapBlock } from '@/lib/map-data';
import { MIN_TRUSTED_COUNT } from '@/lib/rank';
import { MatchBar } from '../match-bar';

export function ResultCard({
  block,
  match,
  state,
  selected,
  onSelect,
}: {
  block: MapBlock;
  match: MatchResult;
  state: SearchState;
  selected: boolean;
  onSelect: () => void;
}) {
  const median = (state.mode === 'rent' ? block.medianRent : block.medianPrice)[state.flatType];
  const count = (state.mode === 'rent' ? block.rentCount : block.priceCount)[state.flatType] ?? 0;
  const noun = state.mode === 'rent' ? 'rental' : 'sale';
  const lease = block.leaseStartYear ? Math.floor(remainingLeaseYears(block.leaseStartYear)) : null;
  return (
    <article
      onMouseEnter={onSelect}
      className={cn('rounded-2xl border-2 border-ink bg-card p-3 transition', selected ? 'shadow-sticker-lg -translate-y-0.5' : 'shadow-sticker')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/blocks/${block.id}`} className="font-display text-lg leading-tight font-extrabold hover:underline">
            {block.label}
          </Link>
          <p className="text-xs text-ink-3">
            {titleCase(block.town)}
            {block.nearestMrtName && block.nearestMrtM !== null && ` · ${distance(block.nearestMrtM)} to ${block.nearestMrtName}`}
            {lease !== null && ` · ${lease}y lease left`}
          </p>
        </div>
        <SaveButtons id={block.id} />
      </div>
      <div className="mt-2">
        <MatchBar match={match} />
      </div>
      <p className="mt-2 text-sm">
        {median ? (
          <>
            <span className="font-bold">{state.mode === 'rent' ? `${money(median)}/mo` : moneyShort(median)}</span>
            <span className="text-ink-3">
              {' '}
              {flatTypeLabel(state.flatType)} {count < MIN_TRUSTED_COUNT ? `from just ${count} ${noun}${count === 1 ? '' : 's'}, salt to taste` : `median of ${count} ${noun}s`}, last 12 months
            </span>
          </>
        ) : (
          <span className="text-ink-3">
            No {flatTypeLabel(state.flatType)} {state.mode === 'rent' ? 'rentals' : 'sales'} here in the last 12 months.
          </span>
        )}
      </p>
    </article>
  );
}

export function SaveButtons({ id }: { id: number }) {
  const shortlist = useSavedList('shortlist');
  const compare = useSavedList('compare');
  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        onClick={() => compare.toggle(id)}
        aria-pressed={compare.has(id)}
        aria-label={compare.has(id) ? 'Remove from compare' : 'Add to compare'}
        title="Compare"
        className={cn('grid size-8 place-items-center rounded-lg border-2 border-ink', compare.has(id) ? 'bg-sky' : 'bg-card hover:bg-paper-2')}
      >
        <Scale className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => shortlist.toggle(id)}
        aria-pressed={shortlist.has(id)}
        aria-label={shortlist.has(id) ? 'Remove from shortlist' : 'Add to shortlist'}
        title="Shortlist"
        className={cn('grid size-8 place-items-center rounded-lg border-2 border-ink', shortlist.has(id) ? 'bg-peach' : 'bg-card hover:bg-paper-2')}
      >
        <Heart className={cn('size-4', shortlist.has(id) && 'fill-coral')} />
      </button>
    </div>
  );
}
