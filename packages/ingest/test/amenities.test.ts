import { describe, expect, it } from 'vitest';
import { cleanText, parseDmy, parseHawkers, parseMrtExits } from '../src/parse/amenities';

const exit = (STATION_NA: string, EXIT_CODE = 'Exit A') => ({
  properties: { STATION_NA, EXIT_CODE },
  geometry: { type: 'Point' as const, coordinates: [103.8, 1.35] },
});

describe('parseMrtExits', () => {
  it('names MRT and LRT stations distinctly', () => {
    const names = parseMrtExits({ features: [exit('ANG MO KIO MRT STATION'), exit('LAYAR LRT STATION')] }).map((a) => a.name);
    expect(names).toEqual(['Ang Mo Kio MRT', 'Layar LRT']);
  });

  it('resolves exits labelled only with a station code', () => {
    expect(parseMrtExits({ features: [exit('NE18')] })[0]?.name).toBe('Punggol Coast MRT');
  });

  it('skips features without usable coordinates', () => {
    const bad = { ...exit('BISHAN MRT STATION'), geometry: { type: 'Point' as const, coordinates: [0, 0] } };
    expect(parseMrtExits({ features: [bad] })).toEqual([]);
  });
});

describe('parseDmy', () => {
  it('converts d/m/yyyy and rejects placeholders', () => {
    expect(parseDmy('7/9/2026')).toBe('2026-09-07');
    expect(parseDmy('NA')).toBeNull();
    expect(parseDmy(undefined)).toBeNull();
  });
});

describe('parseHawkers', () => {
  // A row shaped like NEA's "Dates of Hawker Centres Closure" file.
  const row = {
    name: 'Adam Road Food Centre',
    latitude_hc: '1.3240',
    longitude_hc: '103.8140',
    q1_cleaningstartdate: '30/3/2026',
    q1_cleaningenddate: '31/3/2026',
    remarks_q1: 'nil',
    q2_cleaningstartdate: 'NA',
    q2_cleaningenddate: 'NA',
    other_works_startdate: '1/4/2026',
    other_works_enddate: '30/6/2026',
    remarks_other_works: 'Repairs and redecoration',
    no_of_food_stalls: '32',
    status: 'Existing',
  };

  it('collects closures in date order and labels them', () => {
    const [hawker] = parseHawkers([row]);
    expect(hawker?.details.closures).toEqual([
      { start: '2026-03-30', end: '2026-03-31', reason: 'Cleaning' },
      { start: '2026-04-01', end: '2026-06-30', reason: 'Repairs and redecoration' },
    ]);
    expect(hawker?.details.foodStalls).toBe(32);
  });

  it('drops rows without coordinates', () => {
    expect(parseHawkers([{ ...row, latitude_hc: '' }])).toEqual([]);
  });
});

describe('cleanText', () => {
  it('repairs characters lost upstream as U+FFFD', () => {
    expect(cleanText('St Andrew�s Secondary')).toBe("St Andrew's Secondary");
    expect(cleanText('POISE@AMKP � Programme')).toBe('POISE@AMKP: Programme');
    expect(cleanText(null)).toBeNull();
  });
});
