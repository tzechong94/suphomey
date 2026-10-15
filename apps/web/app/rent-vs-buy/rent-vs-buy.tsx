'use client';

import { FLAT_TYPES, RENT_VS_BUY_DEFAULTS, rentVsBuy, type FlatType, type RentVsBuyInput } from '@suphomey/core';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BlockSearch } from '@/components/block-search';
import { Card } from '@/components/ui';
import { useBlock } from '@/lib/client/api';
import { flatTypeLabel, money, moneyShort } from '@/lib/format';

type Field = { key: keyof RentVsBuyInput; label: string; unit: '%' | '$' | 'years'; step: number };

const ASSUMPTIONS: Field[] = [
  { key: 'downPayment', label: 'Down payment', unit: '%', step: 1 },
  { key: 'loanRate', label: 'Loan interest rate', unit: '%', step: 0.1 },
  { key: 'loanYears', label: 'Loan tenure', unit: 'years', step: 1 },
  { key: 'upfrontCosts', label: 'Stamp duty, legal & agent fees', unit: '%', step: 0.5 },
  { key: 'priceChange', label: 'Flat value change per year', unit: '%', step: 0.5 },
  { key: 'rentChange', label: 'Rent increase per year', unit: '%', step: 0.5 },
  { key: 'investmentReturn', label: 'What your cash could earn instead', unit: '%', step: 0.1 },
  { key: 'horizonYears', label: 'How long you plan to stay', unit: 'years', step: 1 },
];

export function RentVsBuyPage() {
  const params = useSearchParams();
  const blockParam = Number(params.get('block'));
  const [blockId, setBlockId] = useState<number | null>(Number.isInteger(blockParam) && blockParam > 0 ? blockParam : null);
  const { data: block } = useBlock(blockId);
  const [flatType, setFlatType] = useState<FlatType>('4-ROOM');
  const [input, setInput] = useState<RentVsBuyInput>({ ...RENT_VS_BUY_DEFAULTS, price: 600_000, monthlyRent: 3_200 });

  // Flat types with both a rent and a price median at the chosen block; fall back to the first one.
  const s = block?.summary;
  const usable = s ? FLAT_TYPES.filter((t) => s.medianRent[t] && s.medianPrice[t]) : [];
  const effectiveType = usable.includes(flatType) ? flatType : (usable[0] ?? flatType);

  // Prefill price and rent from the block's real medians whenever the block or flat type changes.
  // This adjusts state during render (React's pattern for state derived from changing inputs),
  // rather than in an effect, which would render once with stale numbers first.
  const prefillKey = s && usable.length ? `${block!.id}:${effectiveType}` : null;
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (prefillKey && prefillKey !== prefilledFor) {
    setPrefilledFor(prefillKey);
    setInput((i) => ({ ...i, price: s!.medianPrice[effectiveType]!, monthlyRent: s!.medianRent[effectiveType]! }));
  }

  const result = useMemo(() => rentVsBuy(input), [input]);
  const last = result.rows.at(-1);
  const set = (key: keyof RentVsBuyInput, value: number) => setInput((i) => ({ ...i, [key]: value }));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">
        Rent or buy? <span aria-hidden>🤔</span>
      </h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Compares money that&apos;s gone for good: rent on one side; interest, fees, lost investment returns and any drop in the flat&apos;s value on the other. Repaid
        loan isn&apos;t a cost, it&apos;s still yours.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="space-y-4 p-4">
          <div>
            <p className="mb-1 text-xs font-bold text-ink-2">Use real numbers from a block (optional)</p>
            <BlockSearch onPick={(hit) => setBlockId(hit.id)} placeholder="Search a block" />
            {block && (
              <p className="mt-2 text-sm">
                Using <Link className="font-semibold underline" href={`/blocks/${block.id}`}>{block.label}</Link>
              </p>
            )}
          </div>
          {block && (
            <label className="block text-xs font-bold text-ink-2">
              Flat type
              <select value={effectiveType} onChange={(e) => setFlatType(e.target.value as FlatType)} className="mt-1 block w-full rounded-xl border-2 border-ink bg-card px-2 py-2 text-sm text-ink">
                {usable.map((t) => (
                  <option key={t} value={t}>
                    {flatTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <NumberField label="Price" value={input.price} onChange={(v) => set('price', v)} prefix="$" step={10_000} />
          <NumberField label="Monthly rent" value={input.monthlyRent} onChange={(v) => set('monthlyRent', v)} prefix="$" step={50} />
          <details>
            <summary className="cursor-pointer text-sm font-bold">Assumptions (tweak me)</summary>
            <div className="mt-3 space-y-3">
              {ASSUMPTIONS.map((f) => (
                <NumberField
                  key={f.key}
                  label={f.label}
                  value={f.unit === '%' ? Math.round(input[f.key] * 1000) / 10 : input[f.key]}
                  onChange={(v) => set(f.key, f.unit === '%' ? v / 100 : v)}
                  suffix={f.unit === '$' ? undefined : f.unit}
                  step={f.step}
                />
              ))}
              <p className="text-xs text-ink-3">
                Default loan rate is HDB&apos;s concessionary rate (0.1 percentage points above the CPF Ordinary Account rate). Bank loans differ.
              </p>
            </div>
          </details>
        </Card>

        <div className="space-y-4">
          <Card className={`p-5 ${result.breakEvenYear ? 'bg-mint' : 'bg-peach'}`}>
            <p className="font-display text-3xl leading-tight font-extrabold" aria-live="polite">
              {result.breakEvenYear
                ? `Buying wins after ${result.breakEvenYear} year${result.breakEvenYear === 1 ? '' : 's'}.`
                : `Renting wins for all ${input.horizonYears} years.`}
            </p>
            <p className="mt-1 text-sm">
              {result.breakEvenYear
                ? `Stay longer than that and buying costs you less than renting. Shorter, and the landlord's deal is better.`
                : `With these numbers, the costs of owning never drop below the rent. Try a longer stay or check the price.`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Fact label="Monthly instalment" value={money(result.monthlyInstalment)} />
              <Fact label="Gross rental yield" value={`${(result.grossYield * 100).toFixed(1)}%`} />
              <Fact label={`Rent paid in ${input.horizonYears}y`} value={last ? moneyShort(last.rentCost) : 'n/a'} />
              <Fact label={`Buying cost in ${input.horizonYears}y`} value={last ? moneyShort(last.buyCost) : 'n/a'} />
            </div>
          </Card>
          <Card className="p-4">
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={result.rows}>
                  <CartesianGrid stroke="#e4ddd0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={(y: number) => `Y${y}`} />
                  <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v) => money(Number(v))} labelFormatter={(y) => `After ${y} year${Number(y) === 1 ? '' : 's'}`} contentStyle={{ border: '2px solid #1f2430', borderRadius: 12 }} />
                  <Legend />
                  <Line dataKey="rentCost" name="Cumulative cost of renting" stroke="#ff7a59" strokeWidth={2.5} dot={false} />
                  <Line dataKey="buyCost" name="Cumulative cost of buying" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-ink-3">Today&apos;s dollars, before tax, ignoring maintenance, renovation and CPF accrued interest. Not financial advice, just very nosy maths.</p>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-ink/20 bg-card/70 px-2 py-1.5">
      <div className="text-[11px] font-semibold text-ink-3">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, prefix, suffix, step }: { label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; step: number }) {
  return (
    <label className="block text-xs font-bold text-ink-2">
      {label}
      <span className="mt-1 flex items-center rounded-xl border-2 border-ink bg-card px-2">
        {prefix && <span className="text-sm text-ink-3">{prefix}</span>}
        <input
          type="number"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent px-1 py-2 text-sm font-semibold text-ink outline-none"
        />
        {suffix && <span className="text-sm text-ink-3">{suffix}</span>}
      </span>
    </label>
  );
}
