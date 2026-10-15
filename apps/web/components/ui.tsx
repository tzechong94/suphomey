import { cn } from '@/lib/cn';

/** Small building blocks in the sticker style. Kept in one file until they outgrow it. */

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-2xl border-2 border-ink bg-card shadow-sticker', className)} {...props} />;
}

type Tone = 'mint' | 'peach' | 'butter' | 'sky' | 'lilac' | 'plain' | 'ink';

const TONES: Record<Tone, string> = {
  mint: 'bg-mint',
  peach: 'bg-peach',
  butter: 'bg-butter',
  sky: 'bg-sky',
  lilac: 'bg-lilac',
  plain: 'bg-card',
  ink: 'bg-ink text-paper',
};

export function Sticker({ tone = 'butter', tilt, className, ...props }: React.ComponentProps<'span'> & { tone?: Tone; tilt?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 text-xs font-bold whitespace-nowrap',
        TONES[tone],
        tilt && '-rotate-2',
        className,
      )}
      {...props}
    />
  );
}

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'border-2 border-ink bg-coral text-ink shadow-sticker hover:brightness-105',
        variant === 'secondary' && 'border-2 border-ink bg-card shadow-sticker hover:bg-paper-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-paper-2 hover:text-ink',
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-2xl font-extrabold tracking-tight">
        <span aria-hidden className="mr-2">
          {emoji}
        </span>
        {title}
      </h2>
      {subtitle && <p className="text-sm text-ink-2">{subtitle}</p>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border-2 border-ink/10 bg-paper px-3 py-2">
      <div className="text-xs font-semibold text-ink-3">{label}</div>
      <div className="font-display text-xl font-extrabold">{value}</div>
      {hint && <div className="text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border-2 border-dashed border-ink/20 px-4 py-3 text-sm text-ink-2">{children}</p>;
}
