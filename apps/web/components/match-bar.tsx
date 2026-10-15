import type { MatchResult } from '@suphomey/core';
import { CRITERION_META } from '@/lib/criteria';

/**
 * The match % with its reasons: one segment per nice-to-have, filled by how
 * well this block does on it. The explanation is in the title (hover) and in a
 * visually hidden list for screen readers.
 */
export function MatchBar({ match }: { match: MatchResult }) {
  const nice = match.parts.filter((p) => p.preference === 'nice');
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="font-display text-lg font-extrabold tabular-nums">{match.percent}%</span>
        <div className="flex h-3 flex-1 gap-0.5" aria-hidden>
          {nice.length === 0 ? (
            <div className="flex-1 rounded-full bg-ink/10" />
          ) : (
            nice.map((p) => (
              <div key={p.criterion} className="relative flex-1 overflow-hidden rounded-full bg-ink/10" title={p.explanation}>
                <div className="absolute inset-y-0 left-0 rounded-full border-r border-ink/20" style={{ width: `${Math.round(p.score * 100)}%`, background: CRITERION_META[p.criterion].color }} />
              </div>
            ))
          )}
        </div>
      </div>
      <ul className="sr-only">
        {match.parts.map((p) => (
          <li key={p.criterion}>
            {p.preference === 'must' ? 'Must have. ' : ''}
            {p.explanation}
          </li>
        ))}
      </ul>
    </div>
  );
}
