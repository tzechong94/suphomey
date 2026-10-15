'use client';

import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Empty } from '@/components/ui';
import { useInsight } from '@/lib/client/api';
import { blockLabel, money, moneyShort, monthLabel, titleCase } from '@/lib/format';

const AXIS = { fontSize: 11 };
const TOOLTIP = { contentStyle: { border: '2px solid #1f2430', borderRadius: 12 } };

function Tea({ title, kicker, children, note }: { title: string; kicker: string; children: React.ReactNode; note?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-extrabold tracking-wide text-coral uppercase">{kicker}</p>
      <h2 className="font-display text-2xl leading-tight font-extrabold">{title}</h2>
      <div className="mt-4">{children}</div>
      {note && <p className="mt-3 text-xs text-ink-3">{note}</p>}
    </Card>
  );
}

function Loading<T>({ q, children }: { q: { data?: T; isLoading: boolean; error: Error | null }; children: (data: T) => React.ReactNode }) {
  if (q.error) return <Empty>Couldn&apos;t brew this one: {q.error.message}</Empty>;
  if (q.isLoading || !q.data) return <div className="h-64 animate-pulse rounded-xl bg-paper-2" />;
  return <>{children(q.data)}</>;
}

export function TeaPage() {
  const trend = useInsight<{ month: string; flat_type: string; median: number }[]>('rent-trend');
  const towns = useInsight<{ town: string; recent: number; previous: number; change: number; n: number }[]>('rent-change-by-town');
  const mrt = useInsight<{ band: string; psm: number; n: number }[]>('mrt-premium');
  const lease = useInsight<{ lease_left: number; psm: number; n: number }[]>('lease-decay');
  const schools = useInsight<{ schools: string; psm: number; n: number }[]>('school-premium');
  const bto = useInsight<{ town: string; year: string; bto_low: number; bto_high: number; resale: number | null; n: number }[]>('bto-vs-resale');
  const cheap = useInsight<{ id: number; block: string; street: string; town: string; mrt: string; mrt_m: number; rent: number; n: number }[]>('cheap-near-mrt');

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">
        The Tea <span aria-hidden>☕</span>
      </h1>
      <p className="mt-2 max-w-2xl text-ink-2">What 455,000 HDB rentals and resales say when nobody&apos;s listening. All numbers straight from data.gov.sg.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Tea kicker="Rents" title="How rents moved since 2021" note="Island-wide monthly median of approved rentals, by flat type.">
          <Loading q={trend}>
            {(data) => {
              const byMonth = new Map<string, Record<string, number | string>>();
              for (const r of data) byMonth.set(r.month, { ...(byMonth.get(r.month) ?? { month: r.month }), [r.flat_type]: r.median });
              return (
                <div className="h-64">
                  <ResponsiveContainer>
                    <LineChart data={[...byMonth.values()]}>
                      <CartesianGrid stroke="#e4ddd0" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} minTickGap={50} />
                      <YAxis tickFormatter={money} tick={AXIS} width={60} />
                      <Tooltip labelFormatter={(l) => monthLabel(String(l))} formatter={(v) => money(Number(v))} {...TOOLTIP} />
                      <Legend />
                      <Line dataKey="3-ROOM" name="3-room" stroke="#7fbfa6" dot={false} strokeWidth={2.5} />
                      <Line dataKey="4-ROOM" name="4-room" stroke="#ff7a59" dot={false} strokeWidth={2.5} />
                      <Line dataKey="5-ROOM" name="5-room" stroke="#7d93c9" dot={false} strokeWidth={2.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            }}
          </Loading>
        </Tea>

        <Tea kicker="Rents" title="Where 4-room rents rose most this year" note="Median of the last 12 months against the 12 before. Towns with at least 30 rentals.">
          <Loading q={towns}>
            {(data) => (
              <ol className="space-y-1.5 text-sm">
                {data.slice(0, 8).map((t) => (
                  <li key={t.town} className="grid grid-cols-[1fr_auto_4rem] items-center gap-3">
                    <span className="font-semibold">{titleCase(t.town)}</span>
                    <span className="text-ink-3">
                      {money(t.previous)} → {money(t.recent)}
                    </span>
                    <span className={`text-right font-bold ${t.change > 0 ? 'text-bad' : 'text-good'}`}>
                      {t.change > 0 ? '+' : ''}
                      {t.change}%
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Loading>
        </Tea>

        <Tea kicker="Location" title="Being near the MRT costs you, a bit" note="Median resale price per m², last 24 months, by straight-line distance to the nearest MRT/LRT exit.">
          <Loading q={mrt}>
            {(data) => {
              const base = data.find((d) => d.band === '300')?.psm;
              const first = data.find((d) => d.band === '0')?.psm;
              return (
                <>
                  {base && first && (
                    <p className="mb-2 font-semibold">
                      Within 300 m: {Math.round((first / base - 1) * 100)}% more per m² than 300 to 600 m away.
                    </p>
                  )}
                  <div className="h-52">
                    <ResponsiveContainer>
                      <BarChart data={data.map((d) => ({ ...d, label: { '0': '< 300 m', '300': '300 to 600 m', '600': '600 m to 1 km', '1000': '> 1 km' }[d.band] }))}>
                        <XAxis dataKey="label" tick={AXIS} />
                        <YAxis tickFormatter={money} tick={AXIS} width={60} domain={[0, 'auto']} />
                        <Tooltip formatter={(v) => `${money(Number(v))}/m²`} {...TOOLTIP} />
                        <Bar dataKey="psm" name="Price per m²" fill="#c9ddf7" stroke="#1f2430" strokeWidth={2} radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              );
            }}
          </Loading>
        </Tea>

        <Tea
          kicker="Plot twist"
          title="More schools nearby, lower prices?"
          note="Correlation, not causation: schools cluster in older, denser towns, where flats have less lease left and cost less per m². Don't blame the schools."
        >
          <Loading q={schools}>
            {(data) => (
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={data}>
                    <XAxis dataKey="schools" tick={AXIS} tickFormatter={(s: string) => `${s} within 1 km`} />
                    <YAxis tickFormatter={money} tick={AXIS} width={60} domain={[0, 'auto']} />
                    <Tooltip formatter={(v) => `${money(Number(v))}/m²`} {...TOOLTIP} />
                    <Bar dataKey="psm" name="Price per m²" fill="#ffe9a8" stroke="#1f2430" strokeWidth={2} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Loading>
        </Tea>

        <Tea
          kicker="Lease"
          title="The lease cliff, raw"
          note="Median resale price per m² by lease left at sale, last 24 months. Not adjusted for location: younger flats are mostly in newer towns, so this mixes lease and location effects."
        >
          <Loading q={lease}>
            {(data) => (
              <div className="h-52">
                <ResponsiveContainer>
                  <BarChart data={data}>
                    <XAxis dataKey="lease_left" tick={AXIS} tickFormatter={(v: number) => `${v}+ y`} />
                    <YAxis tickFormatter={money} tick={AXIS} width={60} domain={[0, 'auto']} />
                    <Tooltip formatter={(v) => `${money(Number(v))}/m²`} labelFormatter={(l) => `${l} to ${Number(l) + 4} years left`} {...TOOLTIP} />
                    <Bar dataKey="psm" name="Price per m²" fill="#e3d5f5" stroke="#1f2430" strokeWidth={2} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Loading>
        </Tea>

        <Tea kicker="New vs resale" title="BTO vs resale, 4-room" note="Latest published BTO price range per town (before grants) against the 12-month median 4-room resale price.">
          <Loading q={bto}>
            {(data) => (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-3">
                  <tr>
                    <th className="py-1">Town</th>
                    <th>BTO (year)</th>
                    <th className="text-right">Resale median</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r) => (
                    <tr key={r.town} className="border-t border-ink/5">
                      <td className="py-1 font-semibold">{titleCase(r.town)}</td>
                      <td>
                        {moneyShort(r.bto_low)} to {moneyShort(r.bto_high)} <span className="text-ink-3">({r.year})</span>
                      </td>
                      <td className="text-right">{r.resale ? moneyShort(r.resale) : 'n/a'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Loading>
        </Tea>

        <Tea kicker="Bargain hunt" title="Cheapest 4-room rents within 400 m of rail" note="Median of the last 12 months; blocks with at least 3 rentals.">
          <Loading q={cheap}>
            {(data) => (
              <ol className="space-y-2 text-sm">
                {data.map((b, i) => (
                  <li key={b.id} className="flex items-baseline justify-between gap-3">
                    <Link href={`/blocks/${b.id}`} className="font-semibold hover:underline">
                      {i + 1}. {blockLabel(b.block, b.street)}
                    </Link>
                    <span className="shrink-0 text-ink-3">
                      {b.mrt_m} m to {b.mrt} · <span className="font-bold text-ink">{money(b.rent)}/mo</span> ({b.n})
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Loading>
        </Tea>
      </div>
    </main>
  );
}
