import {
  bigserial,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const blocks = pgTable(
  'blocks',
  {
    id: serial('id').primaryKey(),
    /** "<block>|<street>" as produced by core's blockKey(). */
    key: text('key').notNull(),
    block: text('block').notNull(),
    street: text('street').notNull(),
    town: text('town').notNull(),
    postal: text('postal'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    planningArea: text('planning_area'),
    yearCompleted: integer('year_completed'),
    /** From resale records when available, otherwise the completion year. */
    leaseStartYear: integer('lease_start_year'),
    maxFloor: integer('max_floor'),
    totalUnits: integer('total_units'),
    hasMarketHawker: boolean('has_market_hawker').notNull().default(false),
    hasCarpark: boolean('has_carpark').notNull().default(false),
    hasCommercial: boolean('has_commercial').notNull().default(false),
    /** Sold + rental unit counts by canonical flat type. */
    unitMix: jsonb('unit_mix').$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [uniqueIndex('blocks_key_idx').on(t.key), index('blocks_postal_idx').on(t.postal)],
);

export const resaleTransactions = pgTable(
  'resale_transactions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    blockId: integer('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    month: date('month').notNull(),
    flatType: text('flat_type').notNull(),
    storeyLow: integer('storey_low').notNull(),
    storeyHigh: integer('storey_high').notNull(),
    floorAreaSqm: real('floor_area_sqm').notNull(),
    flatModel: text('flat_model').notNull(),
    leaseStartYear: integer('lease_start_year').notNull(),
    price: integer('price').notNull(),
  },
  (t) => [index('resale_block_type_month_idx').on(t.blockId, t.flatType, t.month), index('resale_month_idx').on(t.month)],
);

export const rentalTransactions = pgTable(
  'rental_transactions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    blockId: integer('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    month: date('month').notNull(),
    flatType: text('flat_type').notNull(),
    rent: integer('rent').notNull(),
  },
  (t) => [index('rental_block_type_month_idx').on(t.blockId, t.flatType, t.month), index('rental_month_idx').on(t.month)],
);

export const amenities = pgTable(
  'amenities',
  {
    id: serial('id').primaryKey(),
    kind: text('kind').notNull(),
    /** Stable identifier from the source dataset, used for upserts. */
    sourceId: text('source_id').notNull(),
    name: text('name').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [uniqueIndex('amenities_kind_source_idx').on(t.kind, t.sourceId)],
);

export const blockAmenities = pgTable(
  'block_amenities',
  {
    blockId: integer('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    amenityId: integer('amenity_id')
      .notNull()
      .references(() => amenities.id, { onDelete: 'cascade' }),
    distanceM: integer('distance_m').notNull(),
  },
  (t) => [primaryKey({ columns: [t.blockId, t.amenityId] }), index('block_amenities_amenity_idx').on(t.amenityId)],
);

/**
 * One denormalised row per block: everything the map and the match score need,
 * so GET /api/blocks is a single scan. Rebuilt after every load.
 */
export const blockSummary = pgTable('block_summary', {
  blockId: integer('block_id')
    .primaryKey()
    .references(() => blocks.id, { onDelete: 'cascade' }),
  nearestMrtM: integer('nearest_mrt_m'),
  nearestMrtName: text('nearest_mrt_name'),
  nearestHawkerM: integer('nearest_hawker_m'),
  nearestPrimarySchoolM: integer('nearest_primary_school_m'),
  nearestParkM: integer('nearest_park_m'),
  nearestClinicM: integer('nearest_clinic_m'),
  nearestPreschoolM: integer('nearest_preschool_m'),
  busStops400m: integer('bus_stops_400m').notNull().default(0),
  hawkers1km: integer('hawkers_1km').notNull().default(0),
  primarySchools1km: integer('primary_schools_1km').notNull().default(0),
  primarySchools2km: integer('primary_schools_2km').notNull().default(0),
  playgrounds500m: integer('playgrounds_500m').notNull().default(0),
  fitnessCorners500m: integer('fitness_corners_500m').notNull().default(0),
  preschools1km: integer('preschools_1km').notNull().default(0),
  clinics1km: integer('clinics_1km').notNull().default(0),
  /** Median monthly rent over the last 12 months, by flat type. */
  medianRent: jsonb('median_rent').$type<Record<string, number>>().notNull().default({}),
  /** Median resale price over the last 12 months, by flat type. */
  medianPrice: jsonb('median_price').$type<Record<string, number>>().notNull().default({}),
  /** How many transactions each median is based on, by flat type. */
  rentCounts: jsonb('rent_counts').$type<Record<string, number>>().notNull().default({}),
  priceCounts: jsonb('price_counts').$type<Record<string, number>>().notNull().default({}),
  rentals12m: integer('rentals_12m').notNull().default(0),
  resales12m: integer('resales_12m').notNull().default(0),
});

export const blockLandUse = pgTable(
  'block_land_use',
  {
    blockId: integer('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    landUse: text('land_use').notNull(),
    areaM2: integer('area_m2').notNull(),
  },
  (t) => [primaryKey({ columns: [t.blockId, t.landUse] })],
);

export const blockProgrammes = pgTable(
  'block_programmes',
  {
    blockId: integer('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    programme: text('programme').notNull(),
    name: text('name').notNull(),
    status: text('status'),
    estimatedCompletion: text('estimated_completion'),
  },
  (t) => [primaryKey({ columns: [t.blockId, t.programme, t.name] })],
);

export const riskAreas = pgTable('risk_areas', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  caseCount: integer('case_count'),
  /** GeoJSON Polygon or MultiPolygon in WGS84. */
  geometry: jsonb('geometry').$type<GeoJsonPolygonal>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const townStats = pgTable(
  'town_stats',
  {
    metric: text('metric').notNull(),
    period: text('period').notNull(),
    town: text('town').notNull(),
    flatType: text('flat_type').notNull(),
    value: real('value').notNull(),
    valueHigh: real('value_high'),
  },
  (t) => [primaryKey({ columns: [t.metric, t.period, t.town, t.flatType] })],
);

export const ingestionRuns = pgTable(
  'ingestion_runs',
  {
    id: serial('id').primaryKey(),
    dataset: text('dataset').notNull(),
    status: text('status').notNull(),
    rows: integer('rows'),
    message: text('message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('ingestion_runs_dataset_idx').on(t.dataset, t.startedAt)],
);

export type GeoJsonPolygonal =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] };
