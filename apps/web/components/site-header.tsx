'use client';

import { Heart, Menu, Scale } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DropdownMenu } from 'radix-ui';
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
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
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
        <nav aria-label="Main" className="ml-2 hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active = isActive(item.href);
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
        <div className="flex-1 lg:hidden" />
        <CountLink href={`/compare?ids=${compare.ids.join(',')}`} label="Compare" count={compare.ids.length} icon={<Scale className="size-4" />} />
        <CountLink href="/shortlist" label="Shortlist" count={shortlist.ids.length} icon={<Heart className="size-4" />} />
        <MobileMenu isActive={isActive} />
      </div>
    </header>
  );
}

/** Below lg the pill nav does not fit beside the logo, so it collapses into a menu. */
function MobileMenu({ isActive }: { isActive: (href: string) => boolean }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label="Menu"
        className="inline-flex items-center rounded-xl border-2 border-ink bg-card px-2.5 py-1.5 shadow-sticker hover:bg-paper-2 lg:hidden"
      >
        <Menu className="size-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-40 min-w-48 rounded-2xl border-2 border-ink bg-paper p-1.5 shadow-sticker-lg"
        >
          {NAV.map((item) => (
            <DropdownMenu.Item key={item.href} asChild>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'block rounded-xl px-3 py-2 text-sm font-semibold text-ink-2 outline-none data-[highlighted]:bg-paper-2 data-[highlighted]:text-ink',
                  isActive(item.href) && 'bg-ink text-paper data-[highlighted]:bg-ink data-[highlighted]:text-paper',
                )}
              >
                {item.label}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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
