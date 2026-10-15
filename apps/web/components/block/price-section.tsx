'use client';

import { FLAT_TYPES, type FlatType } from '@suphomey/core';
import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/cn';
import { useTransactions } from '@/lib/client/api';
import { flatTypeLabel, money, moneyShort, monthLabel } from '@/lib/format';
import type { BlockProfile } from '@/lib/server/block-profile';
import { Empty, Stat } from '../ui';
import { FairPriceCheck } from './fair-price-check';

type Kind = 'rent' | 'resale';

export function PriceSection({ profile }: { profile: BlockProfile }) {
  const s = profile.summary;
  const types = FLAT_TYPES.filter((t) => s?.medianRent[t] || s?.medianPrice[t] || profile.unitMix[t]);
  const busiest = [...types].sort((a, b) => (s?.rentCounts?.[b] ?? 0) - (s?.rentCounts?.[a] ?? 0))[0] ?? '4-ROOM';
  const [kind, setKind] = useState<Kind>(s && !s.medianRent[busiest] && s.medianPrice[busiest] ? 'resale' : 'rent');
  const [flatType, setFlatType] = useState<FlatType>(busiest);
  const { data, isFetching } = useTransactions(profile.id, kind, flatType);

  const median = kind === 'rent' ? s?.medianRent[flatType] : s?.medianPrice[flatType];
  const count = (kind === 'rent' ? s?.rentCounts : s?.priceCounts)?.[flatType] ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border-2 border-ink p-0.5" role="radiogroup" aria-label="Rent or resale">
          {(['rent', 'resale'] as const).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn('rounded-lg px-3 py-1 text-sm font-bold', kind === k ? 'bg-ink text-paper' : 'hover:bg-paper-2')}
            >
              {k === 'rent' ? 'Rent' : 'Resale'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Flat type">
          {types.map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={flatType === t}
              onClick={() => setFlatType(t)}
              className={cn('rounded-full border-2 border-ink px-3 py-1 text-sm font-semibold', flatType === t ? 'bg-butter shadow-sticker' : 'bg-card')}
            >
              {flatTypeLabel(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          label={`Median ${kind === 'rent' ? 'rent' : 'price'}, last 12 months`}
          value={median ? (kind === 'rent' ? `${money(median)}/mo` : moneyShort(median)) : 'n/a'}
          hint={median ? `from ${count} ${kind === 'rent' ? 'rental' : 'sale'}${count === 1 ? '' : 's'}${count < 3 ? ' (thin data)' : ''}` : 'none in the last 12 months'}
        />
        <Stat label={`${kind === 'rent' ? 'Rentals' : 'Resales'} on record`} value={(data?.series ?? []).reduce((n, p) => n + p.count, 0) || '0'} hint={kind === 'rent' ? 'since Jan 2021' : 'since Jan 2017'} />
        {s?.medianRent[flatType] && s.medianPrice[flatType] ? (
          <Stat label="Gross rental yield" value={`${(((s.medianRent[flatType] * 12) / s.medianPrice[flatType]) * 100).toFixed(1)}%`} hint="annual rent ÷ price" />
        ) : null}
      </div>

      {data && data.series.length > 0 ? (
        <div className={cn('h-56 rounded-xl border-2 border-ink/10 bg-paper p-2 transition-opacity', isFetching && 'opacity-60')}>
          <ResponsiveContainer width="100%" height="100%">
            {/* A true time axis: months with no deals leave gaps instead of being squeezed out. */}
            <LineChart data={data.series.map((p) => ({ ...p, t: Date.parse(p.month) }))} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#e4ddd0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t: number) => monthLabel(new Date(t).toISOString().slice(0, 10))}
                tick={{ fontSize: 11 }}
                minTickGap={40}
              />
              <YAxis tickFormatter={(v: number) => (kind === 'rent' ? money(v) : moneyShort(v))} tick={{ fontSize: 11 }} width={64} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v, _n, item) => [`${money(Number(v))} (${(item.payload as { count: number }).count} deal${(item.payload as { count: number }).count === 1 ? '' : 's'})`, 'Median']}
                labelFormatter={(t) => monthLabel(new Date(Number(t)).toISOString().slice(0, 10))}
                contentStyle={{ border: '2px solid #1f2430', borderRadius: 12 }}
              />
              <Line type="linear" dataKey="median" stroke="#ff7a59" strokeWidth={2.5} dot={{ r: 3, stroke: '#1f2430', strokeWidth: 1, fill: '#ff7a59' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Empty>
          No {flatTypeLabel(flatType)} {kind === 'rent' ? 'rentals' : 'resales'} recorded at this block. Even we can&apos;t kaypoh much here.
        </Empty>
      )}

      {data && data.recent.length > 0 && (
        <details className="rounded-xl border-2 border-ink/10 bg-paper px-3 py-2">
          <summary className="cursor-pointer text-sm font-bold">Latest {kind === 'rent' ? 'rentals' : 'resales'} at this block (all flat types)</summary>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr>
                <th className="py-1">Month</th>
                <th>Type</th>
                {kind === 'resale' && <th>Storey</th>}
                {kind === 'resale' && <th>Size</th>}
                <th className="text-right">{kind === 'rent' ? 'Rent' : 'Price'}</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((t, i) => (
                <tr key={i} className="border-t border-ink/5">
                  <td className="py-1">{monthLabel(t.month)}</td>
                  <td>{flatTypeLabel(t.flatType)}</td>
                  {'price' in t && <td>{`${t.storeyLow} to ${t.storeyHigh}`}</td>}
                  {'price' in t && <td>{t.floorAreaSqm} m²</td>}
                  <td className="text-right font-semibold">{'rent' in t ? `${money(t.rent)}/mo` : money(t.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <FairPriceCheck blockId={profile.id} defaultKind={kind} defaultFlatType={flatType} key={`${kind}-${flatType}`} />
    </div>
  );
}
