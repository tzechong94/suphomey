'use client';

import type { FlatType, PriceCheck } from '@suphomey/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { decodeMapPayload, type MapPayload } from '../map-data';
import type { BlockProfile } from '../server/block-profile';

export class ApiError extends Error {}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((body as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const useMapBlocks = () =>
  useQuery({
    queryKey: ['map-blocks'],
    queryFn: async () => decodeMapPayload(await get<MapPayload>('/api/blocks')),
    staleTime: Infinity,
  });

export type SearchHit = { id: number; label: string; town: string; postal: string | null };

export const useBlockSearch = (q: string) =>
  useQuery({
    queryKey: ['search', q],
    queryFn: () => get<SearchHit[]>(`/api/blocks/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
  });

export const useBlock = (id: number | null) =>
  useQuery({
    queryKey: ['block', id],
    queryFn: () => get<BlockProfile>(`/api/blocks/${id}`),
    enabled: id !== null,
  });

export type MonthlyPoint = { month: string; median: number; count: number };
export type Transactions = {
  kind: 'rent' | 'resale';
  series: MonthlyPoint[];
  recent: ({ month: string; flatType: string; rent: number } | { month: string; flatType: string; price: number; storeyLow: number; storeyHigh: number; floorAreaSqm: number; flatModel: string })[];
};

export const useTransactions = (id: number, kind: 'rent' | 'resale', flatType: FlatType | null) =>
  useQuery({
    queryKey: ['transactions', id, kind, flatType],
    queryFn: () => get<Transactions>(`/api/blocks/${id}/transactions?kind=${kind}${flatType ? `&flatType=${flatType}` : ''}`),
    placeholderData: keepPreviousData,
  });

export type PriceCheckParams = { blockId: number; kind: 'rent' | 'resale'; flatType: FlatType; amount: number };

export const usePriceCheck = (params: PriceCheckParams | null) =>
  useQuery({
    queryKey: ['price-check', params],
    queryFn: () => {
      const p = params!;
      return get<PriceCheckParams & { result: PriceCheck | null }>(
        `/api/price-check?blockId=${p.blockId}&kind=${p.kind}&flatType=${p.flatType}&amount=${p.amount}`,
      );
    },
    enabled: params !== null,
  });

export type LiveCarpark = { carParkNo: string; available: number | null; total: number | null; updatedAt: string };

export const useLiveCarparks = (ids: string[]) =>
  useQuery({
    queryKey: ['carparks', ids],
    queryFn: () => get<{ timestamp: string | null; carparks: LiveCarpark[] }>(`/api/carparks/live?ids=${ids.join(',')}`),
    enabled: ids.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

export function useInsight<T>(name: string) {
  return useQuery({ queryKey: ['insight', name], queryFn: () => get<T>(`/api/insights/${name}`) });
}
