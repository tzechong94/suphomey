import { getDb } from '@suphomey/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { BlockIllustration } from '@/components/block/block-illustration';
import { MiniMap } from '@/components/block/client-bits';
import { PriceSection } from '@/components/block/price-section';
import { GettingAround, GreenAndPlay, HeadsUp, HealthAndElders, Kids, Makan, WhatsComing } from '@/components/block/sections';
import { SaveButtons } from '@/components/explore/result-card';
import { Card, SectionTitle, Sticker } from '@/components/ui';
import { distance, flatTypeLabel, titleCase } from '@/lib/format';
import { getBlockProfile } from '@/lib/server/block-profile';
import { vibesFor, type Vibe } from '@/lib/vibes';

// Literal class names so Tailwind can see them (it cannot detect `bg-${tone}`).
const VIBE_BG: Record<Vibe['tone'], string> = { mint: 'bg-mint', peach: 'bg-peach', butter: 'bg-butter', sky: 'bg-sky', lilac: 'bg-lilac' };

// Shared by generateMetadata and the page, so the database is queried once per request.
const load = cache(async (rawId: string) => {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? getBlockProfile(getDb(), id) : null;
});

export async function generateMetadata({ params }: PageProps<'/blocks/[id]'>): Promise<Metadata> {
  const profile = await load((await params).id);
  return profile ? { title: profile.label, description: `Rents, resale prices and what's nearby for ${profile.label}, ${titleCase(profile.town)}.` } : {};
}

export default async function BlockPage({ params }: PageProps<'/blocks/[id]'>) {
  const profile = await load((await params).id);
  if (!profile) notFound();
  const s = profile.summary;
  const vibes = s
    ? vibesFor({ ...s, hasMarketHawker: profile.hasMarketHawker, remainingLeaseYears: profile.remainingLeaseYears, maxFloor: profile.maxFloor })
    : [];
  const unitTypes = Object.entries(profile.unitMix).sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16">
      <nav className="mb-4 text-sm text-ink-3">
        <Link href="/" className="hover:underline">
          Explore
        </Link>{' '}
        / {titleCase(profile.town)}
      </nav>

      <section className="mb-8 grid items-end gap-6 md:grid-cols-[auto_1fr_auto]">
        <BlockIllustration id={profile.id} floors={profile.maxFloor} label={profile.label} />
        <div>
          <h1 className="font-display text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl">{profile.label}</h1>
          <p className="mt-1 text-ink-2">
            {titleCase(profile.town)}
            {profile.postal ? ` · Singapore ${profile.postal}` : ''}
            {profile.yearCompleted ? ` · Built ${profile.yearCompleted}` : ''}
            {profile.maxFloor ? ` · ${profile.maxFloor} storeys` : ''}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.remainingLeaseYears !== null && (
              <li>
                <Sticker tone="lilac">⏳ {Math.floor(profile.remainingLeaseYears)} years of lease left</Sticker>
              </li>
            )}
            {s?.nearestMrtName && s.nearestMrtM !== null && (
              <li>
                <Sticker tone="sky">
                  🚇 {distance(s.nearestMrtM)} to {s.nearestMrtName}
                </Sticker>
              </li>
            )}
            {s?.nearestHawkerM != null && (
              <li>
                <Sticker tone="peach">🍜 Hawker {distance(s.nearestHawkerM)}</Sticker>
              </li>
            )}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <SaveButtons id={profile.id} />
          <Link href={`/rent-vs-buy?block=${profile.id}`} className="text-sm font-bold underline decoration-coral decoration-2 underline-offset-4">
            Rent or buy here? Do the maths →
          </Link>
        </div>
      </section>

      {vibes.length > 0 && (
        <ul className="mb-8 grid gap-3 sm:grid-cols-2" aria-label="The vibe">
          {vibes.map((v, i) => (
            <li key={v.text} className={`rounded-2xl border-2 border-ink px-4 py-3 font-semibold shadow-sticker ${VIBE_BG[v.tone]} ${i % 2 ? 'rotate-[0.6deg]' : '-rotate-[0.6deg]'}`}>
              <span aria-hidden className="mr-2">
                {v.emoji}
              </span>
              {v.text}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-6">
        <Card className="p-5">
          <SectionTitle emoji="💸" title="The damage" subtitle="Real rents and resale prices at this block, from HDB's records." />
          <PriceSection profile={profile} />
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="p-5">
            <SectionTitle emoji="🏢" title="The building" />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-ink-3">Lease started</dt>
                <dd className="font-bold">{profile.leaseStartYear ?? 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Lease left</dt>
                <dd className="font-bold">{profile.remainingLeaseYears !== null ? `${profile.remainingLeaseYears} years` : 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Flats in block</dt>
                <dd className="font-bold">{profile.totalUnits ?? 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Planning area</dt>
                <dd className="font-bold">{profile.planningArea ? titleCase(profile.planningArea) : 'Unknown'}</dd>
              </div>
            </dl>
            {unitTypes.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-1 text-sm font-extrabold tracking-wide text-ink-2 uppercase">Flat mix</h3>
                <div className="flex h-4 overflow-hidden rounded-full border-2 border-ink">
                  {unitTypes.map(([type, n], i) => (
                    <span key={type} title={`${flatTypeLabel(type)}: ${n}`} style={{ flex: n, background: ['#bde7d6', '#ffd2b8', '#ffe9a8', '#c9ddf7', '#e3d5f5'][i % 5] }} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-2">{unitTypes.map(([t, n]) => `${n} × ${flatTypeLabel(t)}`).join(' · ')}</p>
              </div>
            )}
          </Card>
          <MiniMap profile={profile} />
        </div>

        <Card className="p-5">
          <SectionTitle emoji="🚇" title="Getting around" subtitle="Straight-line distances; walking routes may be longer." />
          <GettingAround nearby={profile.nearby} busStops={s?.busStops400m ?? 0} />
        </Card>
        <Card className="p-5">
          <SectionTitle emoji="🍜" title="Makan" subtitle="Hawker centres and their scheduled closures." />
          <Makan nearby={profile.nearby} hasMarketHawker={profile.hasMarketHawker} />
        </Card>
        <Card className="p-5">
          <SectionTitle emoji="🎒" title="Kids" subtitle="Schools, preschools with vacancy status, and student care." />
          <Kids nearby={profile.nearby} primary1km={s?.primarySchools1km ?? 0} primary2km={s?.primarySchools2km ?? 0} />
        </Card>
        <Card className="p-5">
          <SectionTitle emoji="🩺" title="Health & elders" />
          <HealthAndElders nearby={profile.nearby} clinics1km={s?.clinics1km ?? 0} />
        </Card>
        <Card className="p-5">
          <SectionTitle emoji="🌳" title="Green & play" />
          <GreenAndPlay nearby={profile.nearby} playgrounds={s?.playgrounds500m ?? 0} fitness={s?.fitnessCorners500m ?? 0} />
        </Card>
        <Card className="p-5">
          <SectionTitle emoji="🔮" title="What's coming" subtitle="What the land around you is zoned for, and upgrading works." />
          <WhatsComing landUse={profile.landUse} programmes={profile.programmes} />
        </Card>
        <Card className="p-5">
          <SectionTitle emoji="🦟" title="Heads-up" />
          <HeadsUp risks={profile.risks} />
        </Card>
      </div>
    </main>
  );
}
