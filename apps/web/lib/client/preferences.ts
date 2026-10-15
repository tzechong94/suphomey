'use client';

import { CRITERIA, FLAT_TYPES, type Budget, type Criterion, type FlatType, type Preference, type Preferences } from '@suphomey/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * What the user is looking for, kept in the URL so a search can be shared or
 * bookmarked: ?mode=rent&type=4-ROOM&max=3200&must=mrt,hawker&nice=park,lease
 */
export type Mode = 'rent' | 'buy';

export type SearchState = {
  mode: Mode;
  flatType: FlatType;
  /** Monthly rent or purchase price; null = no budget. */
  max: number | null;
  prefs: Preferences;
};

export const DEFAULT_STATE: SearchState = { mode: 'rent', flatType: '4-ROOM', max: null, prefs: { mrt: 'nice', hawker: 'nice' } };

const isCriterion = (s: string): s is Criterion => (CRITERIA as readonly string[]).includes(s);

export function parseSearchState(params: URLSearchParams): SearchState {
  const mode = params.get('mode') === 'buy' ? 'buy' : params.get('mode') === 'rent' ? 'rent' : DEFAULT_STATE.mode;
  const type = params.get('type');
  const flatType = (FLAT_TYPES as readonly string[]).includes(type ?? '') ? (type as FlatType) : DEFAULT_STATE.flatType;
  const max = Number(params.get('max'));
  const hasChips = params.has('must') || params.has('nice');
  const prefs: Preferences = {};
  for (const [key, pref] of [['nice', 'nice'], ['must', 'must']] as const) {
    for (const c of (params.get(key) ?? '').split(',')) if (isCriterion(c)) prefs[c] = pref;
  }
  return { mode, flatType, max: Number.isFinite(max) && max > 0 ? max : null, prefs: hasChips ? prefs : DEFAULT_STATE.prefs };
}

export function serializeSearchState(state: SearchState): string {
  const params = new URLSearchParams({ mode: state.mode, type: state.flatType });
  if (state.max) params.set('max', String(state.max));
  const of = (p: Preference) => CRITERIA.filter((c) => state.prefs[c] === p).join(',');
  params.set('must', of('must'));
  params.set('nice', of('nice'));
  return params.toString();
}

export function budgetOf(state: SearchState): Budget | undefined {
  return state.max ? { mode: state.mode, flatType: state.flatType, max: state.max } : undefined;
}

export function useSearchState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const state = useMemo(() => parseSearchState(new URLSearchParams(params.toString())), [params]);
  const update = useCallback(
    (patch: Partial<SearchState>) => {
      const next = { ...state, ...patch, prefs: patch.prefs ?? state.prefs };
      router.replace(`${pathname}?${serializeSearchState(next)}`, { scroll: false });
    },
    [state, router, pathname],
  );
  return [state, update] as const;
}

/** Off -> nice -> must -> off */
export const nextPreference = (p: Preference | undefined): Preference => (p === 'nice' ? 'must' : p === 'must' ? 'off' : 'nice');
