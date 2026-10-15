'use client';

import { Heart, Scale } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useSavedList } from '@/lib/client/saved';

const NAV = [
  { href: '/', label: 'Explore' },
  { href: '/check', label: 'Price check' },
  { href: '/rent-vs-buy', label: 'Rent vs buy' },
  { href: '/tea', label: 'The Tea' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const shortlist = useSavedList('shortlist');
  const compare = useSavedList('compare');
  return (
    <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-baseline gap-1.5" aria-label="suphomey home">
          <span className="font-display text-2xl font-extrabold tracking-tight">
            sup<span className="text-coral">homey</span>
          </span>
          <span aria-hidden className="hidden -rotate-6 text-lg sm:inline">
            🏠
          </span>
        </Link>
        <nav aria-label="Main" className="ml-2 flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-ink-2 hover:bg-paper-2 hover:text-ink',
                  active && 'bg-ink text-paper hover:bg-ink hover:text-paper',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <CountLink href={`/compare?ids=${compare.ids.join(',')}`} label="Compare" count={compare.ids.length} icon={<Scale className="size-4" />} />
        <CountLink href="/shortlist" label="Shortlist" count={shortlist.ids.length} icon={<Heart className="size-4" />} />
      </div>
    </header>
  );
}

function CountLink({ href, label, count, icon }: { href: string; label: string; count: number; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      // The text label is hidden on small screens, so the link names itself (with the count).
      aria-label={count > 0 ? `${label} (${count})` : label}
      className="relative inline-flex items-center gap-1.5 rounded-xl border-2 border-ink bg-card px-2.5 py-1.5 text-sm font-bold shadow-sticker hover:bg-paper-2"
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      {count > 0 && (
        <span aria-hidden className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full border-2 border-ink bg-coral text-[10px]">
          {count}
        </span>
      )}
    </Link>
  );
}
