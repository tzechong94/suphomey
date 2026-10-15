'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMapBlocks } from '@/lib/client/api';
import { useSearchState } from '@/lib/client/preferences';
import { cn } from '@/lib/cn';
import { rankBlocks, type SortKey } from '@/lib/rank';
import { BlockSearch } from '../block-search';
import { Card, Empty } from '../ui';
import { Filters } from './filters';
import { ResultCard } from './result-card';
import { SetupQuiz } from './setup-quiz';

// MapLibre needs the browser (WebGL), so it is never rendered on the server.
const BlockMap = dynamic(() => import('../block-map'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-paper-2 text-sm text-ink-3">Unfolding the map…</div>,
});

const PAGE = 10;

export function Explore() {
  const router = useRouter();
  const [state, update] = useSearchState();
  const { data: blocks, isLoading, error } = useMapBlocks();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>('match');
  const [shown, setShown] = useState(PAGE);

  const ranked = useMemo(() => (blocks ? rankBlocks(blocks, state, sort) : null), [blocks, state, sort]);
  const dots = useMemo(
    () => ranked?.all.map(({ block, match }) => ({ id: block.id, lat: block.lat, lng: block.lng, label: block.label, percent: match.percent, passes: match.passes })) ?? [],
    [ranked],
  );
  const selected = ranked?.all.find((r) => r.block.id === selectedId) ?? null;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-10">
      <section className="mb-6 grid items-end gap-4 lg:grid-cols-[1fr_auto]">
        <div>
          <h1 className="font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
            Sup, homey. <span className="text-coral">Let&apos;s find you one.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-ink-2">
            We kaypoh&apos;d every HDB block: real rents and resale prices, MRT, hawkers, schools and what&apos;s planned next door. You just tell us what
            matters.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SetupQuiz onDone={update} />
          <Link href="/check" className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-butter px-4 py-2 text-sm font-bold shadow-sticker hover:brightness-105">
            🧐 Got a listing? Check it
          </Link>
        </div>
      </section>

      <BlockSearch className="mb-6 max-w-2xl" onPick={(hit) => router.push(`/blocks/${hit.id}`)} />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="order-2 space-y-4 lg:order-1">
          <Card className="p-4">
            <Filters state={state} onChange={(patch) => { update(patch); setShown(PAGE); }} />
          </Card>

          {error ? (
            <Empty>Couldn&apos;t load blocks: {error.message}. Is the database seeded? (pnpm db:seed)</Empty>
          ) : isLoading || !ranked ? (
            <Empty>Kaypoh-ing 10,000+ blocks…</Empty>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" aria-live="polite">
                  <span className="font-display text-xl font-extrabold">{ranked.passing.length.toLocaleString('en-SG')}</span> blocks pass your must-haves
                </p>
                <label className="text-xs font-semibold text-ink-2">
                  <span className="sr-only">Sort by</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border-2 border-ink bg-card px-2 py-1">
                    <option value="match">Best match</option>
                    <option value="cheapest">Cheapest first</option>
                  </select>
                </label>
              </div>
              {ranked.passing.length === 0 ? (
                <Empty>Nothing passes all your must-haves. Either loosen a chip or we start looking at Punggol.</Empty>
              ) : (
                <ol className="space-y-3">
                  {ranked.passing.slice(0, shown).map(({ block, match }) => (
                    <li key={block.id}>
                      <ResultCard block={block} match={match} state={state} selected={block.id === selectedId} onSelect={() => setSelectedId(block.id)} />
                    </li>
                  ))}
                </ol>
              )}
              {ranked.passing.length > shown && (
                <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full rounded-xl border-2 border-dashed border-ink/40 py-2 text-sm font-semibold hover:bg-paper-2">
                  Show {Math.min(PAGE, ranked.passing.length - shown)} more
                </button>
              )}
            </>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <div className="relative h-[55vh] overflow-hidden rounded-3xl border-2 border-ink shadow-sticker-lg lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)]">
            <BlockMap dots={dots} selectedId={selectedId} onSelect={setSelectedId} />
            <Legend />
            {selected && (
              <div className="absolute inset-x-3 bottom-3 sm:right-auto sm:w-96">
                <ResultCard block={selected.block} match={selected.match} state={state} selected onSelect={() => {}} />
                {!selected.match.passes && (
                  <p className="mt-1 rounded-lg bg-ink px-2 py-1 text-xs text-paper">Heads up: this one fails a must-have.</p>
                )}
                <Link href={`/blocks/${selected.block.id}`} className="mt-2 block rounded-xl border-2 border-ink bg-coral py-2 text-center text-sm font-bold shadow-sticker">
                  Kaypoh this block →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Legend() {
  return (
    <div className="absolute top-3 left-3 rounded-xl border-2 border-ink bg-card/95 px-3 py-2 text-xs font-semibold shadow-sticker">
      <div className="mb-1">Match</div>
      <div className="flex items-center gap-2">
        <span>low</span>
        <span className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg,#ffe9a8,#ffb48f,#ff7a59,#c2361b)' }} />
        <span>high</span>
      </div>
      <div className={cn('mt-1 flex items-center gap-1 text-ink-3')}>
        <span className="inline-block size-2 rounded-full bg-[#9aa0ab]/50" /> fails a must-have
      </div>
    </div>
  );
}
