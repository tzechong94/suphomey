import { outerRing, ringCentroid, VACANCY_LEVELS, type AmenityKind, type LatLng, type Polygonal } from '@suphomey/core';
import { blankToNull, toNumber, type CsvRow } from '../csv';
import { isPolygonal, pointOf, props, svy21ToLatLng, type Feature, type FeatureCollection } from '../geojson';

export type Amenity = LatLng & {
  kind: AmenityKind;
  sourceId: string;
  name: string;
  details: Record<string, unknown>;
};

/** Points that only feed counts (bus stops, playgrounds); they are not stored individually. */
export type CountedPoint = LatLng & { kind: 'bus_stop' | 'playground' | 'fitness_corner' };

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());

function points<T>(fc: FeatureCollection, map: (p: Record<string, string>, at: LatLng, f: Feature) => T | null): T[] {
  return fc.features.flatMap((f) => {
    const at = pointOf(f);
    if (!at) return [];
    const out = map(props(f), at, f);
    return out ? [out] : [];
  });
}

/**
 * A few exits (mostly at stations opened since 2024) are labelled with the
 * station code instead of its name. These are all the codes present in the
 * 2026-10 file; an unknown code is kept as is rather than dropped.
 */
const STATION_CODES: Record<string, string> = {
  CC9: 'PAYA LEBAR MRT STATION',
  CC30: 'KEPPEL MRT STATION',
  CC31: 'CANTONMENT MRT STATION',
  CC32: 'PRINCE EDWARD ROAD MRT STATION',
  DT4: 'HUME MRT STATION',
  DT18: 'TELOK AYER MRT STATION',
  NE18: 'PUNGGOL COAST MRT STATION',
};

export function parseMrtExits(fc: FeatureCollection): Amenity[] {
  return points(fc, (p, at) => {
    const raw = STATION_CODES[p.STATION_NA!] ?? p.STATION_NA!;
    // "LAYAR LRT STATION" -> "Layar LRT": LRT stations count as rail access too, but should say so.
    const line = /LRT STATION$/.test(raw) ? 'LRT' : 'MRT';
    const station = `${titleCase(raw.replace(/ (MRT|LRT) STATION$/, ''))} ${line}`;
    return { kind: 'mrt_exit', sourceId: `${p.STATION_NA}|${p.EXIT_CODE}`, name: station, ...at, details: { exit: p.EXIT_CODE, line } };
  });
}

/** d/m/yyyy -> yyyy-mm-dd, or null for "NA" and similar. */
export function parseDmy(value: string | undefined): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value?.trim() ?? '');
  return m ? `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : null;
}

export type Closure = { start: string; end: string; reason: string };

/**
 * NEA's closure list doubles as the hawker centre directory: it has every open
 * centre with coordinates, stall counts and this year's cleaning closures.
 */
export function parseHawkers(rows: CsvRow[]): Amenity[] {
  return rows.flatMap((r) => {
    const lat = toNumber(r.latitude_hc);
    const lng = toNumber(r.longitude_hc);
    if (lat === null || lng === null) return [];
    const closures: Closure[] = [];
    for (const q of ['q1', 'q2', 'q3', 'q4']) {
      const start = parseDmy(r[`${q}_cleaningstartdate`]);
      const end = parseDmy(r[`${q}_cleaningenddate`]);
      if (start && end) closures.push({ start, end, reason: blankToNull(r[`remarks_${q}`]) ?? 'Cleaning' });
    }
    const worksStart = parseDmy(r.other_works_startdate);
    const worksEnd = parseDmy(r.other_works_enddate);
    if (worksStart && worksEnd) closures.push({ start: worksStart, end: worksEnd, reason: blankToNull(r.remarks_other_works) ?? 'Other works' });
    return [
      {
        kind: 'hawker' as const,
        sourceId: r.name!,
        name: r.name!,
        lat,
        lng,
        details: {
          address: blankToNull(r.address_myenv),
          foodStalls: toNumber(r.no_of_food_stalls),
          marketStalls: toNumber(r.no_of_market_stalls),
          description: blankToNull(r.description_myenv),
          isNew: r.status === 'Existing (new)',
          closures: closures.sort((a, b) => a.start.localeCompare(b.start)),
        },
      },
    ];
  });
}

/**
 * Some MOE text arrives with characters already lost upstream (U+FFFD), where
 * the original was an apostrophe ("St Andrew\uFFFDs") or, between spaces, a dash.
 */
export function cleanText(s: string | null): string | null {
  return s === null ? null : s.replace(/ \uFFFD /g, ': ').replace(/\uFFFD/g, "'");
}

const schoolNameKey = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\b(SCHOOL|SAINT|ST)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export type SchoolRecord = Omit<Amenity, 'lat' | 'lng'> & { postal: string };

/** MOE's list has postal codes but no coordinates; build-seed geocodes them. */
export function parseSchools(rows: CsvRow[], programmeRows: CsvRow[]): SchoolRecord[] {
  const programmes = new Map(programmeRows.map((p) => [schoolNameKey(p.school_name!), p]));
  return rows.flatMap((r) => {
    const level = r.mainlevel_code ?? '';
    const kinds: AmenityKind[] = [];
    if (level === 'PRIMARY' || level.includes('P1')) kinds.push('primary_school');
    if (level.startsWith('SECONDARY') || level.includes('S1')) kinds.push('secondary_school');
    const p = programmes.get(schoolNameKey(r.school_name!));
    return kinds.map((kind) => ({
      kind,
      sourceId: r.school_name!,
      name: titleCase(r.school_name!),
      postal: r.postal_code!.padStart(6, '0'),
      details: {
        level,
        url: blankToNull(r.url_address),
        address: blankToNull(r.address),
        nearestMrt: blankToNull(r.mrt_desc),
        sap: r.sap_ind === 'Yes',
        autonomous: r.autonomous_ind === 'Yes',
        gifted: r.gifted_ind === 'Yes',
        integratedProgramme: r.ip_ind === 'Yes',
        motherTongues: [r.mothertongue1_code, r.mothertongue2_code, r.mothertongue3_code].flatMap((m) => blankToNull(m) ?? []),
        appliedLearning: p ? cleanText(blankToNull(p.alp_title)) : null,
        lifeLearning: p ? cleanText(blankToNull(p.llp_title)) : null,
      },
    }));
  });
}

/**
 * ECDA's centre listing (vacancies, food, languages) has no coordinates; the
 * separate "Pre-Schools Location" layer has coordinates keyed by centre code.
 * Centres missing from that layer are placed by postal code when it matches an
 * HDB building (most preschools sit in HDB void decks).
 */
export function parsePreschools(
  centres: CsvRow[],
  locations: FeatureCollection,
  locateByPostal: (postal: string) => LatLng | undefined,
  /** "YYYY-MM" the file was fetched in: the vacancy columns' "current month". */
  asOfMonth: string,
): { amenities: Amenity[]; unplaced: number } {
  const byCode = new Map(points(locations, (p, at) => [p.CENTRE_CODE!, at] as const));
  let unplaced = 0;
  const amenities = centres.flatMap((r) => {
    const code = blankToNull(r.centre_code);
    if (!code) return [];
    const at = byCode.get(code) ?? locateByPostal((r.postal_code ?? '').padStart(6, '0'));
    if (!at) {
      unplaced++;
      return [];
    }
    const vacancies = Object.fromEntries(
      VACANCY_LEVELS.map((level) => [
        level,
        ['current', 'next', 'third', 'fourth', 'fifth', 'sixth', 'seventh'].map((m) => r[`${level}_vacancy_${m}_month`] ?? 'Not Applicable'),
      ]),
    );
    return [
      {
        kind: 'preschool' as const,
        sourceId: code,
        name: r.centre_name!,
        ...at,
        details: {
          operator: blankToNull(r.organisation_description),
          serviceModel: blankToNull(r.service_model),
          address: blankToNull(r.centre_address),
          website: blankToNull(r.centre_website),
          food: blankToNull(r.food_offered),
          secondLanguages: blankToNull(r.second_languages_offered),
          sparkCertified: r.spark_certified === 'Yes',
          weekdayHours: blankToNull(r.weekday_full_day),
          saturdayHours: blankToNull(r.saturday),
          governmentSubsidy: r.government_subsidy === 'Yes',
          vacancies,
          /** "YYYY-MM" the vacancy columns are relative to (their "current month"). */
          vacancyMonth: asOfMonth,
          /** "YYYY-MM" the centre last updated its listing; older listings may have stale vacancies. */
          listingUpdated: blankToNull(r.last_updated)?.slice(0, 7) ?? null,
        },
      },
    ];
  });
  return { amenities, unplaced };
}

export function parseStudentCare(fc: FeatureCollection): Amenity[] {
  return points(fc, (p, at) => ({
    kind: 'student_care',
    sourceId: p.UNIQUE_ID ?? p.NAME_OF_STUDENT_CARE_CENTRE!,
    name: p.NAME_OF_STUDENT_CARE_CENTRE!,
    ...at,
    details: {
      monthlyFee: toNumber(p.MONTHLY_FEE),
      enrolment: toNumber(p.ENROLMENT),
      address: blankToNull(p.SCC_ADDRESS),
      subsidised: p.SCFA_Y_N === 'Y',
    },
  }));
}

export function parseClinics(fc: FeatureCollection): Amenity[] {
  return points(fc, (p, at) => ({
    kind: 'clinic',
    sourceId: p.HCI_CODE!,
    name: titleCase(p.HCI_NAME!),
    ...at,
    details: { programmes: (blankToNull(p.CLINIC_PROGRAMME_CODE) ?? '').split(',').filter(Boolean), phone: blankToNull(p.HCI_TEL) },
  }));
}

/**
 * Generic point layers with just a name: libraries, CCs, pharmacies, eldercare,
 * sport centres. The CC layer still lists closed temporary premises ("(Till 1Q
 * 2022)") and unbuilt ones ("(Pending U/C)"); those are dropped.
 */
export function parseNamedPoints(fc: FeatureCollection, kind: AmenityKind, nameField: string): Amenity[] {
  return points(fc, (p, at) => {
    const name = blankToNull(p[nameField]);
    if (!name || /\((till|pending)\b/i.test(name)) return null;
    return { kind, sourceId: `${name}|${at.lat.toFixed(5)}`, name, ...at, details: {} };
  });
}

/**
 * Parks are polygons. The amenity is placed at the outline's centre, but
 * distances use the nearest outline vertex: what matters is how far the
 * park's edge is, not its middle.
 */
export function parseParks(fc: FeatureCollection): { amenities: Amenity[]; edges: (LatLng & { sourceId: string })[] } {
  const amenities: Amenity[] = [];
  const edges: (LatLng & { sourceId: string })[] = [];
  for (const f of fc.features) {
    if (!isPolygonal(f.geometry)) continue;
    const p = props(f);
    const ring = outerRing(f.geometry as Polygonal);
    const sourceId = p.L_CODE ?? p.NAME!;
    amenities.push({
      kind: 'park',
      sourceId,
      name: titleCase((p.NAME ?? 'Park').replace(/ PG$/, ' Playground')),
      ...ringCentroid(ring),
      details: { natureReserve: p.N_RESERVE === '1' },
    });
    for (const [lng, lat] of ring) edges.push({ lat: lat!, lng: lng!, sourceId });
  }
  return { amenities, edges };
}

export function parseCarparks(rows: CsvRow[]): Amenity[] {
  return rows.flatMap((r) => {
    const x = toNumber(r.x_coord);
    const y = toNumber(r.y_coord);
    if (x === null || y === null) return [];
    return [
      {
        kind: 'carpark' as const,
        sourceId: r.car_park_no!,
        name: titleCase(r.address!),
        ...svy21ToLatLng(x, y),
        details: {
          carParkNo: r.car_park_no,
          type: titleCase(r.car_park_type ?? ''),
          freeParking: blankToNull(r.free_parking),
          nightParking: r.night_parking === 'YES',
          shortTermParking: blankToNull(r.short_term_parking),
          gantryHeightM: toNumber(r.gantry_height),
        },
      },
    ];
  });
}

export function parseCountedPoints(busStops: FeatureCollection, parkFacilities: FeatureCollection): CountedPoint[] {
  const out: CountedPoint[] = points(busStops, (_p, at) => ({ kind: 'bus_stop' as const, ...at }));
  for (const f of parkFacilities.features) {
    const at = pointOf(f);
    const cls = props(f).CLASS;
    if (!at) continue;
    if (cls === 'PLAYGROUND') out.push({ kind: 'playground', ...at });
    if (cls === 'FITNESS AREA') out.push({ kind: 'fitness_corner', ...at });
  }
  return out;
}
