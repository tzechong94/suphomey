'use client';

import { Search } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { useBlockSearch, type SearchHit } from '@/lib/client/api';

/** Search by block + street or postal code. Keyboard: arrows to move, Enter to pick, Escape to close. */
export function BlockSearch({
  onPick,
  placeholder = 'Block, street or postal code (e.g. 406 Ang Mo Kio)',
  className,
  autoFocus,
}: {
  onPick: (hit: SearchHit) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const { data: hits = [], isFetching } = useBlockSearch(q);
  const listId = useId();
  const showList = open && q.trim().length >= 2;

  const pick = (hit: SearchHit) => {
    onPick(hit);
    setQ('');
    setOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <label className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-card px-3 py-2.5 shadow-sticker focus-within:shadow-sticker-lg">
        <Search className="size-5 shrink-0 text-ink-3" aria-hidden />
        <span className="sr-only">Find a block</span>
        <input
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          value={q}
          placeholder={placeholder}
          className="w-full bg-transparent text-base outline-none placeholder:text-ink-3"
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && hits[active]) {
              e.preventDefault();
              pick(hits[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
      </label>
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border-2 border-ink bg-card shadow-sticker">
          {hits.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-2">{isFetching ? 'Kaypoh-ing…' : 'No block like that. Typo, or a condo?'}</li>
          ) : (
            hits.map((hit, i) => (
              <li
                key={hit.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={cn('flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5', i === active && 'bg-butter')}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(hit);
                }}
              >
                <span className="font-semibold">{hit.label}</span>
                <span className="text-xs text-ink-3">
                  {hit.town}
                  {hit.postal ? ` · S${hit.postal}` : ''}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
