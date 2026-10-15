'use client';

import { sgDate, VACANCY_LEVELS, type VacancyLevel } from '@suphomey/core';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useLiveCarparks } from '@/lib/client/api';
import { describeClosure, nextClosure, type Closure } from '@/lib/closures';
import { distance, freeParking, money, titleCase, walkMinutes } from '@/lib/format';
import type { BlockProfile, NearbyPlace } from '@/lib/server/block-profile';
import { Empty, Sticker } from '../ui';

type Nearby = BlockProfile['nearby'];

function PlaceRow({ place, children }: { place: NearbyPlace; children?: React.ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3 border-t border-ink/5 py-2 first:border-t-0">
      <div className="min-w-0">
        <div className="font-semibold">{/[a-z]/.test(place.name) ? place.name : titleCase(place.name)}</div>
        {children && <div className="mt-0.5 text-xs text-ink-2">{children}</div>}
      </div>
      <div className="shrink-0 text-right text-sm">
        <div className="font-bold tabular-nums">{distance(place.distanceM)}</div>
        <div className="text-xs text-ink-3">~{walkMinutes(place.distanceM)} min walk</div>
      </div>
    </li>
  );
}

function Group({ title, places, empty, render }: { title: string; places?: NearbyPlace[]; empty: string; render?: (p: NearbyPlace) => React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-extrabold tracking-wide text-ink-2 uppercase">{title}</h3>
      {places && places.length > 0 ? (
        <ul>
          {places.map((p) => (
            <PlaceRow key={p.id} place={p}>
              {render?.(p)}
            </PlaceRow>
          ))}
        </ul>
      ) : (
        <p className="py-2 text-sm text-ink-3">{empty}</p>
      )}
    </div>
  );
}

export function GettingAround({ nearby, busStops }: { nearby: Nearby; busStops: number }) {
  const carparks = nearby.carpark ?? [];
  const live = useLiveCarparks(carparks.map((c) => String(c.details.carParkNo)));
  const lots = new Map(live.data?.carparks.map((c) => [c.carParkNo, c]) ?? []);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <Group title="Rail" places={nearby.mrt_exit} empty="No MRT or LRT exit within 1.5 km." render={(p) => `${p.details.exit ?? ''}`} />
        <p className="text-sm">
          <Sticker tone="sky">🚏 {busStops} bus stop{busStops === 1 ? '' : 's'}</Sticker> within 400 m
        </p>
      </div>
      <Group
        title="HDB carparks (live)"
        places={carparks}
        empty="No HDB carpark within 300 m."
        render={(p) => {
          const lot = lots.get(String(p.details.carParkNo));
          return (
            <>
              {lot?.available != null ? (
                <span className={cn('font-bold', lot.available < 10 ? 'text-bad' : 'text-good')}>
                  {lot.available} of {lot.total} lots free now
                </span>
              ) : live.isLoading ? (
                'Checking lots…'
              ) : (
                'No live data for this carpark'
              )}
              {freeParking(String(p.details.freeParking ?? '')) ? ` · Free parking: ${freeParking(String(p.details.freeParking))}` : ''}
            </>
          );
        }}
      />
    </div>
  );
}

export function Makan({ nearby, hasMarketHawker }: { nearby: Nearby; hasMarketHawker: boolean }) {
  const today = sgDate();
  return (
    <div>
      {hasMarketHawker && (
        <p className="mb-3">
          <Sticker tone="peach" tilt>
            🍜 Market or hawker in this very block
          </Sticker>
        </p>
      )}
      <Group
        title="Hawker centres within 1.5 km"
        places={nearby.hawker}
        empty="No hawker centre within 1.5 km. Kopitiams may save you."
        render={(p) => {
          const closure = nextClosure((p.details.closures as Closure[]) ?? [], today);
          return (
            <>
              {p.details.foodStalls ? `${p.details.foodStalls} cooked food stalls` : null}
              {closure && <span className={cn('ml-1', closure.ongoing && 'font-bold text-bad')}>· {describeClosure(closure)}</span>}
            </>
          );
        }}
      />
    </div>
  );
}

const VACANCY_STYLE: Record<string, string> = { Available: 'bg-mint', Limited: 'bg-butter', Full: 'bg-peach', 'Not Applicable': 'bg-card text-ink-3' };
const LEVEL_LABEL: Record<VacancyLevel, string> = { infant: 'Infant', pg: 'Playgroup', n1: 'Nursery 1', n2: 'Nursery 2', k1: 'K1', k2: 'K2' };

/** A listing not updated in the three months before the data was published. */
function isStale(listingUpdated: unknown, vacancyMonth: string | undefined): boolean {
  if (typeof listingUpdated !== 'string' || !vacancyMonth) return false;
  const months = (s: string) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7));
  return months(vacancyMonth) - months(listingUpdated) > 3;
}

function addMonths(yyyyMm: string, n: number): string {
  const [y, m] = yyyyMm.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toLocaleDateString('en-SG', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function Kids({ nearby, primary1km, primary2km }: { nearby: Nearby; primary1km: number; primary2km: number }) {
  const [level, setLevel] = useState<VacancyLevel>('infant');
  const [offset, setOffset] = useState(0);
  const vacancyMonth = nearby.preschool?.find((p) => p.details.vacancyMonth)?.details.vacancyMonth as string | undefined;
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 flex flex-wrap gap-2 text-sm">
          <Sticker tone="butter">🎒 {primary1km} within 1 km</Sticker>
          <Sticker tone="plain">{primary2km} within 2 km</Sticker>
        </p>
        <p className="mb-2 text-xs text-ink-3">
          P1 registration gives priority by home distance (within 1 km, then 1 to 2 km). Distances here are straight-line from the block; MOE measures from your exact
          address, so check theirs before you commit.
        </p>
        <Group
          title="Primary schools within 2 km"
          places={nearby.primary_school}
          empty="No primary school within 2 km."
          render={(p) => (
            <span className="flex flex-wrap items-center gap-1">
              {p.distanceM <= 1000 ? <Sticker tone="mint">within 1 km</Sticker> : <Sticker tone="plain">1 to 2 km</Sticker>}
              {p.details.sap ? <Sticker tone="lilac">SAP</Sticker> : null}
              {p.details.gifted ? <Sticker tone="lilac">GEP</Sticker> : null}
              {p.details.appliedLearning ? <span>{String(p.details.appliedLearning)}</span> : null}
            </span>
          )}
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="mr-2 text-sm font-extrabold tracking-wide text-ink-2 uppercase">Preschool vacancies</h3>
          <select value={level} onChange={(e) => setLevel(e.target.value as VacancyLevel)} aria-label="Level" className="rounded-lg border-2 border-ink bg-card px-2 py-1 text-sm">
            {VACANCY_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
          {vacancyMonth && (
            <select value={offset} onChange={(e) => setOffset(Number(e.target.value))} aria-label="Month needed" className="rounded-lg border-2 border-ink bg-card px-2 py-1 text-sm">
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i} value={i}>
                  {addMonths(vacancyMonth, i)}
                </option>
              ))}
            </select>
          )}
        </div>
        <Group
          title="Within 1 km"
          places={nearby.preschool}
          empty="No preschool within 1 km."
          render={(p) => {
            const status = (p.details.vacancies as Record<VacancyLevel, string[]> | undefined)?.[level]?.[offset] ?? 'Not Applicable';
            return (
              <span className="flex flex-wrap items-center gap-1">
                <span className={cn('rounded-full border border-ink px-2 text-[11px] font-bold', VACANCY_STYLE[status])}>{status === 'Not Applicable' ? 'No such class' : status}</span>
                {p.details.operator ? <span>{String(p.details.operator)}</span> : null}
                {p.details.secondLanguages ? <span>· {String(p.details.secondLanguages).replace(/\|/g, ', ')}</span> : null}
                {isStale(p.details.listingUpdated, vacancyMonth) ? <span className="text-warn">· listing last updated {String(p.details.listingUpdated)}, may be stale</span> : null}
              </span>
            );
          }}
        />
        <p className="mt-1 text-xs text-ink-3">Vacancy status as published by ECDA. Call the centre to confirm before you plan around it.</p>
      </div>

      <Group
        title="Student care"
        places={nearby.student_care}
        empty="No student care centre within 1.5 km."
        render={(p) => (p.details.monthlyFee ? `${money(Number(p.details.monthlyFee))}/month${p.details.subsidised ? ' · subsidy available' : ''}` : null)}
      />
    </div>
  );
}

export function HealthAndElders({ nearby, clinics1km }: { nearby: Nearby; clinics1km: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Group title={`CHAS clinics (${clinics1km} within 1 km)`} places={nearby.clinic} empty="No CHAS clinic within 1 km." />
      <Group title="Pharmacies" places={nearby.pharmacy} empty="No retail pharmacy within 1.5 km." />
      <Group title="Eldercare" places={nearby.eldercare} empty="No eldercare centre within 1.5 km." />
    </div>
  );
}

export function GreenAndPlay({ nearby, playgrounds, fitness }: { nearby: Nearby; playgrounds: number; fitness: number }) {
  return (
    <div className="space-y-4">
      <p className="flex flex-wrap gap-2 text-sm">
        <Sticker tone="mint">🛝 {playgrounds} playgrounds</Sticker>
        <Sticker tone="mint">💪 {fitness} fitness corners</Sticker>
        <span className="text-ink-3">in NParks spaces within 500 m</span>
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <Group title="Parks" places={nearby.park} empty="No park within 1 km." />
        <div className="space-y-4">
          <Group title="Community clubs" places={nearby.community_club} empty="No community club within 1.5 km." />
          <Group title="Libraries" places={nearby.library} empty="No public library within 2.5 km." />
          <Group title="Sport centres" places={nearby.sport_centre} empty="No ActiveSG sport centre within 3 km." />
        </div>
      </div>
    </div>
  );
}

const LAND_USE_NOTES: Record<string, string> = {
  'RESERVE SITE': 'kept aside for a future use that has not been decided',
  WHITE: 'flexible zoning: the mix of uses is up to the developer',
  'BUSINESS 1': 'light, clean industry',
  'BUSINESS 2': 'heavier industry',
  'BUSINESS PARK': 'offices and R&D',
  'EDUCATIONAL INSTITUTION': 'schools and colleges',
  'TRANSPORT FACILITIES': 'depots, interchanges and similar',
  UTILITY: 'substations, pumping stations and similar',
};

export function WhatsComing({ landUse, programmes }: { landUse: BlockProfile['landUse']; programmes: BlockProfile['programmes'] }) {
  const watch = landUse.filter((l) => ['RESERVE SITE', 'WHITE', 'BUSINESS 2'].includes(l.landUse) && l.share >= 0.02);
  return (
    <div className="space-y-4">
      {watch.length > 0 && (
        <p className="rounded-xl border-2 border-ink bg-butter px-3 py-2 text-sm">
          <strong>Worth a look:</strong> {watch.map((w) => `${Math.round(w.share * 100)}% ${titleCase(w.landUse)} (${LAND_USE_NOTES[w.landUse]})`).join('; ')} within
          500 m. Check URA&apos;s Master Plan for what exactly is planned.
        </p>
      )}
      {landUse.length > 0 ? (
        <ul className="space-y-1.5">
          {landUse.slice(0, 8).map((l) => (
            <li key={l.landUse} className="grid grid-cols-[minmax(0,12rem)_1fr_3rem] items-center gap-2 text-sm">
              <span className="truncate" title={LAND_USE_NOTES[l.landUse]}>
                {titleCase(l.landUse)}
              </span>
              <span className="h-3 overflow-hidden rounded-full bg-ink/10">
                <span className="block h-full rounded-full bg-lilac" style={{ width: `${Math.max(2, l.share * 100)}%` }} />
              </span>
              <span className="text-right tabular-nums">{Math.round(l.share * 100)}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No Master Plan data around this block.</Empty>
      )}
      <p className="text-xs text-ink-3">Share of land within 500 m by Master Plan 2025 zoning (roads excluded), estimated on a 50 m grid.</p>
      {programmes.length > 0 && (
        <ul className="space-y-1 text-sm">
          {programmes.map((p) => (
            <li key={`${p.programme}-${p.name}`}>
              <Sticker tone="sky">{p.programme === 'LUP' ? '🛗 Lift upgrading' : '🏗️ Neighbourhood renewal'}</Sticker> {titleCase(p.name)}: {p.status ?? 'status unknown'}
              {p.estimatedCompletion ? `, expected ${p.estimatedCompletion}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HeadsUp({ risks }: { risks: BlockProfile['risks'] }) {
  if (risks.length === 0) return <p className="text-sm text-ink-2">No active dengue cluster or high-Aedes area covers this block right now.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {risks.map((r) => (
        <li key={`${r.kind}-${r.name}`} className="rounded-xl border-2 border-ink/20 bg-card px-3 py-2">
          {r.kind === 'dengue' ? (
            <>
              <strong>Active dengue cluster</strong> ({r.name}
              {r.caseCount ? `, ${r.caseCount} cases` : ''}). NEA advises using repellent and clearing stagnant water.
            </>
          ) : (
            <>
              <strong>High Aedes mosquito population area</strong> ({r.name}). Not an outbreak, but worth the repellent.
            </>
          )}
        </li>
      ))}
      <li className="text-xs text-ink-3">From NEA, refreshed daily.</li>
    </ul>
  );
}
