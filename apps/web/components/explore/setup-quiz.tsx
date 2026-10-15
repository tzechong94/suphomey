'use client';

import type { Criterion, FlatType, Preference, Preferences } from '@suphomey/core';
import { X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { Mode, SearchState } from '@/lib/client/preferences';
import { flatTypeLabel } from '@/lib/format';
import { Button } from '../ui';

type Life = 'kids' | 'baby' | 'elderly' | 'commute' | 'foodie' | 'outdoorsy' | 'longTerm';

const LIFE: { id: Life; emoji: string; label: string; sets: Partial<Record<Criterion, Preference>> }[] = [
  { id: 'commute', emoji: '🚇', label: 'I live on the MRT', sets: { mrt: 'must', busStops: 'nice' } },
  { id: 'foodie', emoji: '🍜', label: 'Hawker is my kitchen', sets: { hawker: 'must' } },
  { id: 'kids', emoji: '🎒', label: 'Kids in (or near) primary school', sets: { primarySchool: 'must' } },
  { id: 'baby', emoji: '🍼', label: 'Little ones, need childcare', sets: { preschool: 'nice' } },
  { id: 'elderly', emoji: '👵', label: 'Parents or grandparents with me', sets: { clinic: 'nice', busStops: 'nice' } },
  { id: 'outdoorsy', emoji: '🌳', label: 'Need green to stay sane', sets: { park: 'nice' } },
  { id: 'longTerm', emoji: '⏳', label: 'Staying for the long haul', sets: { lease: 'must' } },
];

/** "Tell me about your life": three quick steps that turn into preference chips. */
export function SetupQuiz({ onDone }: { onDone: (patch: Partial<SearchState>) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>('rent');
  const [flatType, setFlatType] = useState<FlatType>('4-ROOM');
  const [max, setMax] = useState('');
  const [life, setLife] = useState<Set<Life>>(new Set());

  const finish = () => {
    const prefs: Preferences = {};
    for (const item of LIFE) {
      if (!life.has(item.id)) continue;
      for (const [c, p] of Object.entries(item.sets) as [Criterion, Preference][]) {
        // A must-have from any answer wins over a nice-to-have from another.
        if (prefs[c] !== 'must') prefs[c] = p;
      }
    }
    const budget = Number(max.replace(/[^\d]/g, ''));
    if (budget > 0) prefs.budget = 'must';
    if (Object.keys(prefs).length === 0) Object.assign(prefs, { mrt: 'nice', hawker: 'nice' });
    onDone({ mode, flatType, max: budget > 0 ? budget : null, prefs });
    setOpen(false);
    setStep(0);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary">✨ Set me up</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-ink bg-paper p-5 shadow-sticker-lg">
          <div className="flex items-start justify-between">
            <Dialog.Title className="font-display text-2xl font-extrabold">
              {['Rent or buy?', 'What size?', 'Tell me about your life'][step]}
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 hover:bg-paper-2" aria-label="Close">
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm text-ink-2">Step {step + 1} of 3. Skippable, judgement-free.</Dialog.Description>

          <div className="mt-4 min-h-44">
            {step === 0 && (
              <div className="grid grid-cols-2 gap-3">
                {(['rent', 'buy'] as const).map((m) => (
                  <Choice key={m} active={mode === m} onClick={() => setMode(m)} emoji={m === 'rent' ? '🔑' : '🏡'} label={m === 'rent' ? 'Rent' : 'Buy'} />
                ))}
              </div>
            )}
            {step === 1 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(['2-ROOM', '3-ROOM', '4-ROOM', '5-ROOM', 'EXECUTIVE'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFlatType(t)}
                      aria-pressed={flatType === t}
                      className={cn('rounded-full border-2 border-ink px-3 py-1.5 text-sm font-semibold', flatType === t ? 'bg-ink text-paper' : 'bg-card')}
                    >
                      {flatTypeLabel(t)}
                    </button>
                  ))}
                </div>
                <label className="block text-sm font-bold">
                  Budget {mode === 'rent' ? 'per month' : 'to buy'} (optional)
                  <input
                    inputMode="numeric"
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                    placeholder={mode === 'rent' ? '$3,500' : '$650,000'}
                    className="mt-1 w-full rounded-xl border-2 border-ink bg-card px-3 py-2 font-semibold"
                  />
                </label>
              </div>
            )}
            {step === 2 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {LIFE.map((item) => (
                  <Choice
                    key={item.id}
                    small
                    active={life.has(item.id)}
                    onClick={() => setLife((s) => (s.has(item.id) ? new Set([...s].filter((x) => x !== item.id)) : new Set(s).add(item.id)))}
                    emoji={item.emoji}
                    label={item.label}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-between">
            <Button variant="ghost" onClick={() => (step === 0 ? setOpen(false) : setStep(step - 1))}>
              {step === 0 ? 'Nah' : 'Back'}
            </Button>
            <Button onClick={() => (step === 2 ? finish() : setStep(step + 1))}>{step === 2 ? 'Show me blocks' : 'Next'}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Choice({ active, onClick, emoji, label, small }: { active: boolean; onClick: () => void; emoji: string; label: string; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-2 rounded-2xl border-2 border-ink text-left font-semibold transition',
        small ? 'px-3 py-2 text-sm' : 'flex-col justify-center py-6 font-display text-xl font-extrabold',
        active ? 'bg-butter shadow-sticker' : 'bg-card hover:bg-paper-2',
      )}
    >
      <span aria-hidden className={small ? 'text-lg' : 'text-3xl'}>
        {emoji}
      </span>
      {label}
    </button>
  );
}
