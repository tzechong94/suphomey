import { describe, expect, it } from 'vitest';
import { codeFromAnchor, findBuilding, indexBuildings, matchStreets, type Building } from '../src/locate';

// Two streets far apart that both have a block 1, which is the case that makes
// naive block-number matching fail.
const at = (lat: number, lng: number) => ({ lat, lng });
const buildings: Building[] = [
  ...['1', '2', '3', '4', '5'].map((block, i) => ({ streetCode: 'AAA01X', block, postal: `10000${block}`, centre: at(1.3, 103.8 + i * 0.001) })),
  ...['1', '2', '9'].map((block, i) => ({ streetCode: 'BBB02Y', block, postal: `20000${block}`, centre: at(1.4, 103.9 + i * 0.001) })),
  // Same block numbers as BBB02Y, in another town.
  ...['1', '2', '9'].map((block, i) => ({ streetCode: 'CCC03Z', block, postal: `30000${block}`, centre: at(1.25, 103.7 + i * 0.001) })),
];
const index = indexBuildings(buildings);

describe('matchStreets', () => {
  it('matches a street to the code with the same set of blocks', () => {
    const { matched } = matchStreets(new Map([['ALPHA AVE 1', new Set(['1', '2', '3', '4', '5'])]]), index);
    expect(matched).toEqual([{ street: 'ALPHA AVE 1', code: 'AAA01X', score: 1 }]);
  });

  it('marks a street ambiguous when no code is a clear winner', () => {
    // Two codes have exactly these blocks, so block numbers alone cannot tell them apart.
    const { matched, ambiguous } = matchStreets(new Map([['MYSTERY RD', new Set(['1', '2', '9'])]]), index);
    expect(matched).toEqual([]);
    expect(ambiguous).toEqual(['MYSTERY RD']);
  });
});

describe('codeFromAnchor', () => {
  it('picks the code whose building sits at the geocoded anchor', () => {
    expect(codeFromAnchor(index, '1', at(1.4, 103.9))).toBe('BBB02Y');
    expect(codeFromAnchor(index, '1', at(1.3, 103.8))).toBe('AAA01X');
  });

  it('returns null when no building with that number is nearby', () => {
    expect(codeFromAnchor(index, '1', at(1.35, 103.85))).toBeNull();
  });
});

describe('findBuilding', () => {
  it('looks up by street code and block', () => {
    expect(findBuilding(index, 'BBB02Y', '9')?.postal).toBe('200009');
    expect(findBuilding(index, 'AAA01X', '9')).toBeUndefined();
  });
});
