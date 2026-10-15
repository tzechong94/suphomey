import { blockKey } from '@suphomey/core';
import { toNumber, type CsvRow } from '../csv';

/** bldg_contract_town codes in HDB Property Information, mapped to the town names used in resale data. */
export const TOWN_CODES: Record<string, string> = {
  AMK: 'ANG MO KIO',
  BB: 'BUKIT BATOK',
  BD: 'BEDOK',
  BH: 'BISHAN',
  BM: 'BUKIT MERAH',
  BP: 'BUKIT PANJANG',
  BT: 'BUKIT TIMAH',
  CCK: 'CHOA CHU KANG',
  CL: 'CLEMENTI',
  CT: 'CENTRAL AREA',
  GL: 'GEYLANG',
  HG: 'HOUGANG',
  JE: 'JURONG EAST',
  JW: 'JURONG WEST',
  KWN: 'KALLANG/WHAMPOA',
  MP: 'MARINE PARADE',
  PG: 'PUNGGOL',
  PRC: 'PASIR RIS',
  QT: 'QUEENSTOWN',
  SB: 'SEMBAWANG',
  SGN: 'SERANGOON',
  SK: 'SENGKANG',
  TAP: 'TAMPINES',
  TG: 'TENGAH',
  TP: 'TOA PAYOH',
  WL: 'WOODLANDS',
  YS: 'YISHUN',
};

export type BlockAttributes = {
  key: string;
  town: string | null;
  yearCompleted: number | null;
  maxFloor: number | null;
  totalUnits: number | null;
  hasMarketHawker: boolean;
  hasCarpark: boolean;
  hasCommercial: boolean;
  unitMix: Record<string, number>;
};

const UNIT_COLUMNS: [string, string[]][] = [
  ['1-ROOM', ['1room_sold', '1room_rental']],
  ['2-ROOM', ['2room_sold', '2room_rental']],
  ['3-ROOM', ['3room_sold', '3room_rental']],
  ['4-ROOM', ['4room_sold']],
  ['5-ROOM', ['5room_sold']],
  ['EXECUTIVE', ['exec_sold']],
  ['MULTI-GENERATION', ['multigen_sold']],
  ['STUDIO', ['studio_apartment_sold']],
];

/** Residential blocks only; HDB Property Information also lists shops and carparks. */
export function parseHdbProperty(rows: CsvRow[]): BlockAttributes[] {
  return rows
    .filter((r) => r.residential === 'Y')
    .map((r) => {
      const unitMix: Record<string, number> = {};
      for (const [type, cols] of UNIT_COLUMNS) {
        const n = cols.reduce((sum, c) => sum + (toNumber(r[c]) ?? 0), 0);
        if (n > 0) unitMix[type] = n;
      }
      return {
        key: blockKey(r.blk_no!, r.street!),
        town: TOWN_CODES[r.bldg_contract_town ?? ''] ?? null,
        yearCompleted: toNumber(r.year_completed),
        maxFloor: toNumber(r.max_floor_lvl),
        totalUnits: toNumber(r.total_dwelling_units),
        hasMarketHawker: r.market_hawker === 'Y',
        hasCarpark: r.multistorey_carpark === 'Y',
        hasCommercial: r.commercial === 'Y',
        unitMix,
      };
    });
}
