'use client';

import { useSyncExternalStore } from 'react';

/**
 * Shortlist and compare tray, kept in localStorage (no accounts). Uses
 * useSyncExternalStore so every component sees the same list, and so a change
 * in another tab is picked up via the "storage" event.
 */
export type SavedList = 'shortlist' | 'compare';

export const COMPARE_LIMIT = 3;
const KEY = (list: SavedList) => `suphomey:${list}`;
const EMPTY: number[] = [];
const listeners = new Set<() => void>();
const cache = new Map<SavedList, { raw: string | null; ids: number[] }>();

function read(list: SavedList): number[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY(list));
  } catch {
    // Storage can be blocked (private mode, strict settings); behave as empty.
  }
  // Return the same array instance until storage changes, as useSyncExternalStore requires.
  const cached = cache.get(list);
  if (cached && cached.raw === raw) return cached.ids;
  let ids: number[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is number => Number.isInteger(x));
  } catch {
    ids = [];
  }
  cache.set(list, { raw, ids });
  return ids;
}

function write(list: SavedList, ids: number[]) {
  try {
    window.localStorage.setItem(KEY(list), JSON.stringify(ids));
  } catch {
    // Ignore: the list just won't persist.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function useSavedList(list: SavedList) {
  const ids = useSyncExternalStore(subscribe, () => read(list), () => EMPTY);
  const has = (id: number) => ids.includes(id);
  const toggle = (id: number) => {
    const current = read(list);
    if (current.includes(id)) return write(list, current.filter((x) => x !== id));
    // The compare tray holds three blocks; adding a fourth drops the oldest.
    const next = [...current, id];
    write(list, list === 'compare' ? next.slice(-COMPARE_LIMIT) : next);
  };
  const clear = () => write(list, []);
  return { ids, has, toggle, clear };
}
