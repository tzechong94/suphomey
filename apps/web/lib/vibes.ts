/**
 * Short, slightly cheeky one-liners derived from a block's facts. The sass is
 * aimed at situations, never at the user, and every line is backed by a
 * concrete number shown elsewhere on the page.
 */
export type VibeInput = {
  hasMarketHawker: boolean;
  remainingLeaseYears: number | null;
  maxFloor: number | null;
  nearestMrtM: number | null;
  nearestHawkerM: number | null;
  primarySchools1km: number;
  playgrounds500m: number;
  nearestParkM: number | null;
  busStops400m: number;
};

export type Vibe = { emoji: string; text: string; tone: 'mint' | 'peach' | 'butter' | 'sky' | 'lilac' };

export function vibesFor(b: VibeInput): Vibe[] {
  const vibes: Vibe[] = [];
  if (b.hasMarketHawker) vibes.push({ emoji: '🍜', text: 'Hawker downstairs. Your kitchen is now decorative.', tone: 'peach' });
  else if (b.nearestHawkerM !== null && b.nearestHawkerM <= 300) vibes.push({ emoji: '🍜', text: 'Kopi is a 3-minute walk away.', tone: 'peach' });

  if (b.nearestMrtM !== null && b.nearestMrtM <= 300) vibes.push({ emoji: '🚇', text: 'Practically on the MRT. Rain? What rain?', tone: 'sky' });
  else if (b.nearestMrtM !== null && b.nearestMrtM > 1200) vibes.push({ emoji: '🚌', text: 'MRT is a trek. Bus uncle will know you by name.', tone: 'sky' });

  if (b.remainingLeaseYears !== null) {
    if (b.remainingLeaseYears >= 85) vibes.push({ emoji: '⏳', text: 'Plenty of lease left. This block will outlive your sofa.', tone: 'lilac' });
    else if (b.remainingLeaseYears < 55) vibes.push({ emoji: '⏳', text: 'Lease is getting on. Price that in before you fall in love.', tone: 'lilac' });
  }

  if (b.maxFloor !== null && b.maxFloor >= 30) vibes.push({ emoji: '🏙️', text: `Up to ${b.maxFloor} floors. Views come standard, lift queues too.`, tone: 'butter' });
  if (b.primarySchools1km >= 2) vibes.push({ emoji: '🎒', text: `${b.primarySchools1km} primary schools within 1 km. School run: sorted.`, tone: 'butter' });
  if (b.playgrounds500m >= 3) vibes.push({ emoji: '🛝', text: `${b.playgrounds500m} playgrounds within 500 m. Weekends handled.`, tone: 'mint' });
  if (b.nearestParkM !== null && b.nearestParkM <= 150) vibes.push({ emoji: '🌳', text: 'Park on your doorstep. Touch grass, literally.', tone: 'mint' });
  if (b.busStops400m >= 6) vibes.push({ emoji: '🚏', text: `${b.busStops400m} bus stops within 400 m. Spoilt for choice.`, tone: 'sky' });
  return vibes.slice(0, 4);
}
