import { describe, expect, it } from 'vitest';
import { contains, distanceM, ringCentroid, type Polygonal } from '../src/geo';

describe('distanceM', () => {
  it('matches a known distance: one degree of latitude is about 111.2 km', () => {
    expect(distanceM({ lat: 1, lng: 103.8 }, { lat: 2, lng: 103.8 })).toBeCloseTo(111_195, -1);
  });

  it('is zero for the same point and symmetric', () => {
    const a = { lat: 1.3521, lng: 103.8198 };
    const b = { lat: 1.3644, lng: 103.9915 };
    expect(distanceM(a, a)).toBe(0);
    expect(distanceM(a, b)).toBeCloseTo(distanceM(b, a), 6);
  });
});

describe('ringCentroid', () => {
  it('does not double count the closing vertex', () => {
    const square = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ];
    expect(ringCentroid(square)).toEqual({ lat: 1, lng: 1 });
  });
});

describe('contains', () => {
  const squareWithHole: Polygonal = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
        [4, 4],
      ],
    ],
  };

  it('is true inside, false outside and false inside a hole', () => {
    expect(contains(squareWithHole, { lng: 2, lat: 2 })).toBe(true);
    expect(contains(squareWithHole, { lng: 12, lat: 2 })).toBe(false);
    expect(contains(squareWithHole, { lng: 5, lat: 5 })).toBe(false);
  });

  it('checks every part of a multipolygon', () => {
    const multi: Polygonal = {
      type: 'MultiPolygon',
      coordinates: [squareWithHole.coordinates as number[][][], [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]],
    };
    expect(contains(multi, { lng: 25, lat: 25 })).toBe(true);
  });
});
