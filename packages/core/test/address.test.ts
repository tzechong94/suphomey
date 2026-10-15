import { describe, expect, it } from 'vitest';
import { blockKey, displayStreet, expandStreet, normalizeFlatType, parseBlockKey } from '../src/address';

describe('normalizeFlatType', () => {
  it('maps the resale and rental spellings to one canonical value', () => {
    expect(normalizeFlatType('4 ROOM')).toBe('4-ROOM');
    expect(normalizeFlatType('4-ROOM')).toBe('4-ROOM');
    expect(normalizeFlatType(' 2  room ')).toBe('2-ROOM');
    expect(normalizeFlatType('EXECUTIVE')).toBe('EXECUTIVE');
    expect(normalizeFlatType('MULTI-GENERATION')).toBe('MULTI-GENERATION');
  });

  it('rejects anything it does not recognise instead of guessing', () => {
    expect(normalizeFlatType('6 ROOM')).toBeNull();
    expect(normalizeFlatType('')).toBeNull();
  });
});

describe('blockKey', () => {
  it('ignores case and extra whitespace so datasets join cleanly', () => {
    expect(blockKey(' 406 ', 'ang mo kio  ave 10')).toBe('406|ANG MO KIO AVE 10');
    expect(parseBlockKey('406|ANG MO KIO AVE 10')).toEqual({ block: '406', street: 'ANG MO KIO AVE 10' });
  });
});

describe('street names', () => {
  it('expands HDB abbreviations', () => {
    expect(expandStreet("C'WEALTH CRES")).toBe('COMMONWEALTH CRESCENT');
    expect(expandStreet('BT BATOK WEST AVE 6')).toBe('BUKIT BATOK WEST AVENUE 6');
    expect(expandStreet('TENGAH GDN AVE')).toBe('TENGAH GARDEN AVENUE');
    expect(expandStreet('WOODLANDS SQ')).toBe('WOODLANDS SQUARE');
  });

  it('formats for display', () => {
    expect(displayStreet('ANG MO KIO AVE 10')).toBe('Ang Mo Kio Avenue 10');
    expect(displayStreet("C'WEALTH CRES")).toBe("Commonwealth Crescent");
  });
});
