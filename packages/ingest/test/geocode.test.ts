import { describe, expect, it } from 'vitest';
import { pickMatch } from '../src/geocode';

const hit = (BLK_NO: string, ROAD_NAME: string) => ({
  BLK_NO,
  ROAD_NAME,
  POSTAL: '560406',
  LATITUDE: '1.3627',
  LONGITUDE: '103.8541',
});

describe('pickMatch', () => {
  it('accepts a result whose block and expanded street match', () => {
    expect(pickMatch('406|ANG MO KIO AVE 10', [hit('406', 'ANG MO KIO AVENUE 10')])).toEqual({
      key: '406|ANG MO KIO AVE 10',
      postal: '560406',
      lat: 1.3627,
      lng: 103.8541,
    });
  });

  it('skips the same block number on another street', () => {
    const results = [hit('406', 'BEDOK NORTH AVENUE 3'), hit('406', 'ANG MO KIO AVENUE 10')];
    expect(pickMatch('406|ANG MO KIO AVE 10', results)?.lat).toBe(1.3627);
    expect(pickMatch('406|ANG MO KIO AVE 10', [hit('406', 'BEDOK NORTH AVENUE 3')])).toBeNull();
  });

  it('does not treat block 40 as block 406', () => {
    expect(pickMatch('40|ANG MO KIO AVE 10', [hit('406', 'ANG MO KIO AVENUE 10')])).toBeNull();
  });
});
