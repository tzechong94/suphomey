'use client';

import { useQueries } from '@tanstack/react-query';
import { Check, Link2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { SaveButtons } from '@/components/explore/result-card';
import { Button, Card, Empty, Sticker } from '@/components/ui';
import { useSavedList } from '@/lib/client/saved';
import { distance, flatTypeLabel, money, titleCase } from '@/lib/format';
import type { BlockProfile } from '@/lib/server/block-profile';

export function ShortlistPage() {
  const params = useSearchParams();
  const saved = useSavedList('shortlist');
  const shared = (params.get('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const viewingShared = shared.length > 0;
  const ids = viewingShared ? shared : saved.ids;
  const [copied, setCopied] = useState(false);

  const blocks = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['block', id],
      queryFn: async () => {
        const res = await fetch(`/api/blocks/${id}`);
        if (!res.ok) throw new Error('Block not found');
        return (await res.json()) as BlockProfile;
      },
    })),
  }).flatMap((q) => (q.data ? [q.data] : []));

  const share = async () => {
    const url = `${window.location.origin}/shortlist?ids=${saved.ids.join(',')}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight">
            {viewingShared ? 'Someone sent you blocks' : 'Your shortlist'} <span aria-hidden>💌</span>
          </h1>
          <p className="mt-1 text-ink-2">{viewingShared ? 'A shortlist shared with you. Save the ones you like.' : 'Saved on this device only. Share the link with your partner, parents or housemates.'}</p>
        </div>
        {!viewingShared && saved.ids.length > 0 && (
          <Button variant="secondary" onClick={share}>
            {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
            {copied ? 'Link copied' : 'Share shortlist'}
          </Button>
        )}
      </div>

      {ids.length === 0 ? (
        <Empty>
          Empty for now. Tap the ♥ on any block while you <Link href="/" className="underline">explore</Link>.
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {blocks.map((b) => {
            const types = Object.keys(b.summary?.medianRent ?? {});
            return (
              <li key={b.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/blocks/${b.id}`} className="font-display text-xl leading-tight font-extrabold hover:underline">
                        {b.label}
                      </Link>
                      <p className="text-xs text-ink-3">{titleCase(b.town)}</p>
                    </div>
                    <SaveButtons id={b.id} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.remainingLeaseYears !== null && <Sticker tone="lilac">⏳ {Math.floor(b.remainingLeaseYears)}y lease</Sticker>}
                    {b.summary?.nearestMrtName && <Sticker tone="sky">🚇 {distance(b.summary.nearestMrtM)}</Sticker>}
                    {b.summary?.nearestHawkerM != null && <Sticker tone="peach">🍜 {distance(b.summary.nearestHawkerM)}</Sticker>}
                  </div>
                  {types.length > 0 && (
                    <p className="mt-3 text-sm text-ink-2">
                      Typical rent: {types.map((t) => `${flatTypeLabel(t)} ${money(b.summary!.medianRent[t]!)}`).join(' · ')}
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
