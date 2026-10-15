'use client';

import { CRITERIA, FLAT_TYPES, type FlatType } from '@suphomey/core';
import { cn } from '@/lib/cn';
import { nextPreference, type SearchState } from '@/lib/client/preferences';
import { CRITERION_META } from '@/lib/criteria';
import { flatTypeLabel } from '@/lib/format';

type Props = { state: SearchState; onChange: (patch: Partial<SearchState>) => void };

export function Filters({ state, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="radiogroup" aria-label="Rent or buy">
        {(['rent', 'buy'] as const).map((mode) => (
          <button
            key={mode}
            role="radio"
            aria-checked={state.mode === mode}
            onClick={() => onChange({ mode, max: null })}
            className={cn(
              'flex-1 rounded-xl border-2 border-ink px-3 py-2 font-display text-lg font-extrabold transition',
              state.mode === mode ? 'bg-ink text-paper' : 'bg-card hover:bg-paper-2',
            )}
          >
            {mode === 'rent' ? 'Rent' : 'Buy'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-bold text-ink-2">
          Flat type
          <select
            value={state.flatType}
            onChange={(e) => onChange({ flatType: e.target.value as FlatType })}
            className="mt-1 w-full rounded-xl border-2 border-ink bg-card px-2 py-2 text-sm font-semibold text-ink"
          >
            {FLAT_TYPES.map((t) => (
              <option key={t} value={t}>
                {flatTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-ink-2">
          {state.mode === 'rent' ? 'Max rent / month' : 'Max price'}
          <div className="mt-1 flex items-center rounded-xl border-2 border-ink bg-card px-2">
            <span className="text-sm text-ink-3">$</span>
            <input
              inputMode="numeric"
              placeholder={state.mode === 'rent' ? '3,500' : '650,000'}
              value={state.max ? state.max.toLocaleString('en-SG') : ''}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/[^\d]/g, ''));
                onChange({ max: n > 0 ? n : null });
              }}
              className="w-full bg-transparent px-1 py-2 text-sm font-semibold text-ink outline-none"
            />
          </div>
        </label>
      </div>

      <PreferenceChips state={state} onChange={onChange} />
    </div>
  );
}

export function PreferenceChips({ state, onChange }: Props) {
  return (
    <fieldset>
      <legend className="text-xs font-bold text-ink-2">What matters? Tap to cycle: nice to have, must have, don&apos;t care.</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {CRITERIA.map((c) => {
          if (c === 'budget' && !state.max) return null;
          const pref = state.prefs[c] ?? 'off';
          const meta = CRITERION_META[c];
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ prefs: { ...state.prefs, [c]: nextPreference(pref) } })}
              aria-label={`${meta.chip}: ${pref === 'off' ? "don't care" : pref === 'nice' ? 'nice to have' : `must have (${meta.mustHint})`}. Tap to change.`}
              title={pref === 'must' ? meta.mustHint : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition select-none',
                pref === 'off' && 'border-dashed border-ink/30 bg-transparent text-ink-3 hover:border-ink/60',
                pref === 'nice' && 'border-ink bg-butter shadow-sticker',
                pref === 'must' && 'border-ink bg-ink text-paper shadow-sticker',
              )}
            >
              <span aria-hidden>{meta.emoji}</span>
              {meta.chip}
              {pref !== 'off' && <span className={cn('rounded-full px-1.5 text-[10px] font-extrabold uppercase', pref === 'must' ? 'bg-coral text-ink' : 'bg-card')}>{pref}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
