export type Closure = { start: string; end: string; reason: string };

/** The closure in effect today, or else the next one; null if none are left this year. */
export function nextClosure(closures: Closure[], today: string): (Closure & { ongoing: boolean }) | null {
  const upcoming = closures.filter((c) => c.end >= today).sort((a, b) => a.start.localeCompare(b.start));
  const first = upcoming[0];
  return first ? { ...first, ongoing: first.start <= today } : null;
}

const fmt = (iso: string) => new Date(`${iso}T00:00:00+08:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' });

export function describeClosure(c: Closure & { ongoing: boolean }): string {
  const span = c.start === c.end ? fmt(c.start) : `${fmt(c.start)} to ${fmt(c.end)}`;
  const why = c.reason.toLowerCase() === 'cleaning' ? 'for cleaning' : `(${c.reason})`;
  return c.ongoing ? `Closed now until ${fmt(c.end)} ${why}` : `Next closed ${span} ${why}`;
}
