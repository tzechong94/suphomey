'use client';

import { FLAT_TYPES, VERDICTS, type FlatType, type PriceCheck } from '@suphomey/core';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { usePriceCheck, type PriceCheckParams } from '@/lib/client/api';
import { flatTypeLabel, money, monthLabel } from '@/lib/format';
import { Button } from '../ui';

const TONE_BG = { great: 'bg-mint', good: 'bg-mint', neutral: 'bg-butter', warn: 'bg-peach', bad: 'bg-peach' } as const;
const SCOPE_TEXT = { block: 'at this block', street: 'on this street', town: 'in this town' } as const;

export function FairPriceCheck({
  blockId,
  defaultKind = 'rent',
  defaultFlatType = '4-ROOM',
  blockLabel,
}: {
  blockId: number;
  defaultKind?: 'rent' | 'resale';
  defaultFlatType?: FlatType;
  blockLabel?: string;
}) {
  const [kind, setKind] = useState(defaultKind);
  const [flatType, setFlatType] = useState<FlatType>(defaultFlatType);
  const [amount, setAmount] = useState('');
  const [submitted, setSubmitted] = useState<PriceCheckParams | null>(null);
  const { data, isFetching, error } = usePriceCheck(submitted);

  const parsed = Number(amount.replace(/[^\d.]/g, ''));
  return (
    <div className="rounded-2xl border-2 border-ink bg-butter/40 p-4">
      <h3 className="font-display text-xl font-extrabold">🧐 Fair price check</h3>
      <p className="text-sm text-ink-2">Got an asking {kind === 'rent' ? 'rent' : 'price'}{blockLabel ? ` for ${blockLabel}` : ''}? Let&apos;s see how it stacks up against real deals.</p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (parsed > 0) setSubmitted({ blockId, kind, flatType, amount: parsed });
        }}
      >
        <label className="text-xs font-bold text-ink-2">
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value as 'rent' | 'resale')} className="mt-1 block rounded-xl border-2 border-ink bg-card px-2 py-2 text-sm font-semibold text-ink">
            <option value="rent">Rent</option>
            <option value="resale">Buy</option>
          </select>
        </label>
        <label className="text-xs font-bold text-ink-2">
          Flat
          <select value={flatType} onChange={(e) => setFlatType(e.target.value as FlatType)} className="mt-1 block rounded-xl border-2 border-ink bg-card px-2 py-2 text-sm font-semibold text-ink">
            {FLAT_TYPES.map((t) => (
              <option key={t} value={t}>
                {flatTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-xs font-bold text-ink-2">
          Asking {kind === 'rent' ? 'rent per month' : 'price'}
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={kind === 'rent' ? '$3,400' : '$620,000'}
            className="mt-1 block w-full min-w-32 rounded-xl border-2 border-ink bg-card px-3 py-2 text-sm font-semibold text-ink"
          />
        </label>
        <Button type="submit" disabled={!(parsed > 0) || isFetching}>
          {isFetching ? 'Checking…' : 'Check it'}
        </Button>
      </form>

      <div aria-live="polite">
        {error && <p className="mt-3 text-sm text-bad">{error.message}</p>}
        {data && !isFetching && (data.result ? <Verdict result={data.result} amount={data.amount} kind={data.kind} flatType={data.flatType} /> : <NotEnough />)}
      </div>
    </div>
  );
}

function NotEnough() {
  return (
    <p className="mt-3 rounded-xl border-2 border-dashed border-ink/30 bg-card px-3 py-2 text-sm">
      Not enough deals nearby to judge fairly (we need at least 5). Try another flat type, or trust your gut and negotiate anyway.
    </p>
  );
}

export function Verdict({ result, amount, kind, flatType }: { result: PriceCheck; amount: number; kind: 'rent' | 'resale'; flatType: FlatType }) {
  const v = VERDICTS[result.verdict];
  const pct = Math.round(Math.abs(result.vsMedian) * 100);
  // Position on a scale from 20% below to 20% above the median.
  const pos = (x: number) => Math.min(100, Math.max(0, ((x / result.median - 0.8) / 0.4) * 100));
  return (
    <div className={cn('mt-4 rounded-2xl border-2 border-ink p-4 shadow-sticker', TONE_BG[v.tone])}>
      <p className="font-display text-2xl leading-tight font-extrabold">{v.headline}</p>
      <p className="mt-1 text-sm">
        {money(amount)}
        {kind === 'rent' ? '/mo' : ''} is {pct === 0 ? 'right at' : `${pct}% ${result.vsMedian > 0 ? 'above' : 'below'}`} the median of {money(result.median)}, higher than {result.percentile}% of deals.
      </p>
      <div className="relative mt-4 mb-6 h-3 rounded-full bg-card" aria-hidden>
        <div className="absolute inset-y-0 rounded-full bg-ink/15" style={{ left: `${pos(result.p25)}%`, right: `${100 - pos(result.p75)}%` }} />
        <div className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded bg-ink/40" style={{ left: `${pos(result.median)}%` }} />
        <div className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-coral" style={{ left: `${pos(amount)}%` }} />
        <span className="absolute top-5 -translate-x-1/2 text-[10px] font-semibold text-ink-2" style={{ left: `${pos(result.median)}%` }}>
          median
        </span>
      </div>
      <p className="text-xs text-ink-2">
        Middle half of deals: {money(result.p25)} to {money(result.p75)}. Compared with {result.sample.count} {flatTypeLabel(flatType)} {kind === 'rent' ? 'rentals' : 'resales'}{' '}
        {SCOPE_TEXT[result.sample.scope]}, {monthLabel(result.sample.fromMonth)} to {monthLabel(result.sample.toMonth)}.
      </p>
    </div>
  );
}
