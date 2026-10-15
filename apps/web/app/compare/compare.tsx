'use client';

import { FLAT_TYPES, type FlatType } from '@suphomey/core';
import { useQueries } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Empty } from '@/components/ui';
import { cn } from '@/lib/cn';
import { COMPARE_LIMIT, useSavedList } from '@/lib/client/saved';
import { distance, flatTypeLabel, money, moneyShort, titleCase } from '@/lib/format';
import type { BlockProfile } from '@/lib/server/block-profile';

type Row = {
  label: string;
  value: (b: BlockProfile) => number | null;
  format: (v: number, b: BlockProfile) => string;
  better: 'lower' | 'higher';
};

export function ComparePage() {
  const params = useSearchParams();
  const saved = useSavedList('compare');
  const fromUrl = (params.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const ids = (fromUrl.length ? fromUrl : saved.ids).slice(0, COMPARE_LIMIT);
  const [flatType, setFlatType] = useState<FlatType>('4-ROOM');

  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['block', id],
      queryFn: async () => {
        const res = await fetch(`/api/blocks/${id}`);
        if (!res.ok) throw new Error('Block not found');
        return (await res.json()) as BlockProfile;
      },
    })),
  });
  const blocks = queries.flatMap((q) => (q.data ? [q.data] : []));

  if (ids.length === 0) {
    return (
      <Shell>
        <Empty>
          Nothing to compare yet. Tap the ⚖️ on up to {COMPARE_LIMIT} blocks while you <Link href="/" className="underline">explore</Link>.
        </Empty>
      </Shell>
    );
  }

  const rows: Row[] = [
    { label: 'Lease left', value: (b) => b.remainingLeaseYears, format: (v) => `${Math.floor(v)} years`, better: 'higher' },
    { label: `Typical ${flatTypeLabel(flatType)} rent`, value: (b) => b.summary?.medianRent[flatType] ?? null, format: (v) => `${money(v)}/mo`, better: 'lower' },
    { label: `Typical ${flatTypeLabel(flatType)} price`, value: (b) => b.summary?.medianPrice[flatType] ?? null, format: (v) => moneyShort(v), better: 'lower' },
    { label: 'Nearest MRT/LRT', value: (b) => b.summary?.nearestMrtM ?? null, format: (v, b) => `${distance(v)} (${b.summary?.nearestMrtName})`, better: 'lower' },
    { label: 'Nearest hawker centre', value: (b) => b.summary?.nearestHawkerM ?? null, format: (v) => distance(v), better: 'lower' },
    { label: 'Primary schools within 1 km', value: (b) => b.summary?.primarySchools1km ?? null, format: (v) => String(v), better: 'higher' },
    { label: 'Preschools within 1 km', value: (b) => b.summary?.preschools1km ?? null, format: (v) => String(v), better: 'higher' },
    { label: 'CHAS clinics within 1 km', value: (b) => b.summary?.clinics1km ?? null, format: (v) => String(v), better: 'higher' },
    { label: 'Nearest park', value: (b) => b.summary?.nearestParkM ?? null, format: (v) => distance(v), better: 'lower' },
    { label: 'Bus stops within 400 m', value: (b) => b.summary?.busStops400m ?? null, format: (v) => String(v), better: 'higher' },
  ];

  return (
    <Shell>
      <label className="mb-4 inline-flex items-center gap-2 text-sm font-semibold">
        Compare prices for
        <select value={flatType} onChange={(e) => setFlatType(e.target.value as FlatType)} className="rounded-lg border-2 border-ink bg-card px-2 py-1">
          {FLAT_TYPES.map((t) => (
            <option key={t} value={t}>
              {flatTypeLabel(t)}
            </option>
          ))}
        </select>
      </label>
      <div className="overflow-x-auto rounded-2xl border-2 border-ink bg-card shadow-sticker">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="w-48 p-3 text-left text-xs text-ink-3">👑 = best in row</th>
              {blocks.map((b) => (
                <th key={b.id} className="p-3 text-left align-top">
                  <Link href={`/blocks/${b.id}`} className="font-display text-lg leading-tight font-extrabold hover:underline">
                    {b.label}
                  </Link>
                  <div className="text-xs font-normal text-ink-3">{titleCase(b.town)}</div>
                  <button type="button" onClick={() => saved.toggle(b.id)} className="mt-1 text-xs font-semibold text-ink-3 underline">
                    {saved.has(b.id) ? 'Remove' : 'Keep in compare'}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const values = blocks.map((b) => row.value(b));
              const known = values.filter((v): v is number => v !== null);
              const best = known.length > 1 ? (row.better === 'lower' ? Math.min(...known) : Math.max(...known)) : null;
              return (
                <tr key={row.label} className="border-t border-ink/10">
                  <th className="p-3 text-left font-semibold text-ink-2">{row.label}</th>
                  {blocks.map((b, i) => {
                    const v = values[i] ?? null;
                    const isBest = v !== null && v === best && known.some((k) => k !== best);
                    return (
                      <td key={b.id} className={cn('p-3', isBest && 'bg-mint font-bold')}>
                        {v === null ? <span className="text-ink-3">n/a</span> : row.format(v, b)}
                        {isBest && <span aria-label="best"> 👑</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-t border-ink/10">
              <th className="p-3 text-left font-semibold text-ink-2">Mosquito alerts</th>
              {blocks.map((b) => (
                <td key={b.id} className="p-3">
                  {b.risks.length ? b.risks.map((r) => (r.kind === 'dengue' ? 'Dengue cluster' : 'High Aedes area')).join(', ') : 'None'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16">
      <h1 className="mb-6 font-display text-5xl font-extrabold tracking-tight">
        Face-off <span aria-hidden>⚖️</span>
      </h1>
      {children}
    </main>
  );
}
