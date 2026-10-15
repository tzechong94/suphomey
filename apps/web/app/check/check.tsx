'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BlockSearch } from '@/components/block-search';
import { FairPriceCheck } from '@/components/block/fair-price-check';
import type { SearchHit } from '@/lib/client/api';

export function CheckPage() {
  const [hit, setHit] = useState<SearchHit | null>(null);
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">
        Is it a fair price? <span aria-hidden>🧐</span>
      </h1>
      <p className="mt-2 text-ink-2">Pick the block from the listing, tell us the asking rent or price, and we&apos;ll stack it against real HDB deals nearby.</p>

      <BlockSearch className="mt-6" autoFocus onPick={setHit} />

      {hit && (
        <div className="mt-6 space-y-3">
          <p className="text-sm">
            Checking <strong>{hit.label}</strong>, {hit.town}.{' '}
            <Link href={`/blocks/${hit.id}`} className="font-semibold underline decoration-coral decoration-2 underline-offset-4">
              See the full block profile
            </Link>
          </p>
          <FairPriceCheck key={hit.id} blockId={hit.id} blockLabel={hit.label} />
        </div>
      )}
    </main>
  );
}
