# Data

Everything comes from [data.gov.sg](https://data.gov.sg) (Singapore Open Data Licence), except
[OneMap](https://www.onemap.gov.sg) (© Singapore Land Authority), used at build time for 574
lookups (blocks on ambiguous streets and school postal codes), cached in `data/seed/onemap-cache.csv`.
Rebuilding the seed only calls OneMap for keys missing from that cache; set `ONEMAP_API_EMAIL` and
`ONEMAP_API_PASSWORD` to make those calls authenticated. OneMap tokens expire after 72 hours, so
[`onemap-auth.ts`](../packages/ingest/src/onemap-auth.ts) requests one on first use and a new one
shortly before each expires.

Map tiles are from [OpenFreeMap](https://openfreemap.org) (© OpenMapTiles, © OpenStreetMap contributors). Dataset IDs are in
[`packages/ingest/src/datasets.ts`](../packages/ingest/src/datasets.ts); all were checked against the
live catalogue on 2026-10-15.

## What is used, and for what

| Area | Datasets | Used for |
|---|---|---|
| Prices | Resale flat prices (Jan 2017 onwards, 242,737 rows), Renting Out of Flats (Jan 2021 onwards, 212,597 rows) | Block medians, price history, Fair Price Check, insights |
| Market context | Median Rent by Town and Flat Type, Price Range of HDB Flats Offered (BTO), HDB Resale Price Index | Insights |
| Blocks | HDB Property Information (13,392 blocks), HDB Existing Building (13,436 footprints) | Year built, floors, unit mix, hawker/market in block; locating blocks |
| Getting around | LTA MRT Station Exit, LTA Bus Stop, HDB Carpark Information, Carpark Availability (live API) | Nearest exits, bus stop counts, carparks with live lots |
| Food | Hawker Centres, Dates of Hawker Centres Closure | Hawker centres and their cleaning closures |
| Families | General information of schools, School Distinctive Programmes, Pre-Schools Location, ECDA Listing of Centres, Student Care Services | Schools within 1 / 2 km, preschool vacancies, student care fees |
| Health | CHAS Clinics, Retail pharmacy locations, Eldercare Services | Nearby care |
| Green and community | NParks Parks and Nature Reserves, Park Facilities, Libraries, Community Clubs, SportSG Sport Facilities | Parks, playgrounds, fitness corners, CCs |
| Future | Master Plan 2025 Land Use (113,394 zones), HDB Lift Upgrading and Neighbourhood Renewal programmes | "What's coming" around a block |
| Risk | Dengue Clusters, Areas with High Aedes Population | Heads-up on the block page |
| Boundaries | Master Plan 2019 Planning Area Boundary | Planning area per block |

## Pipeline

```
pnpm download        raw files -> data/raw (gitignored, ~300 MB)
pnpm locate-blocks   block number + street -> postal code + coordinates -> data/seed/block-locations.csv
pnpm build-seed      everything -> data/seed/*.json.gz (committed, ~11 MB)
pnpm db:seed         data/seed -> Postgres (about 40 s locally)
pnpm ingest [job]    daily refresh from the live API (also /api/cron/[job])
```

Every parser validates rows (Zod for transactions) and reports rejects instead of dropping them
silently. On the 2026-10-15 files, all 455,334 transaction rows parsed with zero rejects.

## Problems found in the data, and what we did

**Rent and resale rows have no coordinates.** They identify a block only by number and street.
Geocoding about 10,800 blocks through OneMap without a token ran at around 9 blocks a minute (HTTP
429 rate limiting), roughly 20 hours. Instead, `locate-blocks` uses the HDB Existing Building
footprints, which have a postal code and outline for every block but only an opaque street code
(`ST_COD`). A street's set of block numbers works as a fingerprint, so each street name is matched to
the code with the most similar block set (Jaccard similarity), accepted only when it is a clear winner
and the matched buildings sit close together. The 86 ambiguous streets were resolved with one OneMap
lookup each. Result: 10,789 of 10,836 blocks located (99.6%). Against 146 independent OneMap results,
the median error is 8 m and the worst 82 m (footprint centre against address point). The 47
unlocated blocks are new Tengah and Woodlands Square blocks and Tanglin Halt blocks being
redeveloped, none of which OneMap knows yet.

**Many blocks have very few rentals.** 4,212 block and flat type pairs have exactly one rental in the
last 12 months, sometimes far from the market rate (one 4-room in Sengkang rents at $1,500 against a
town median of $3,200, approved three times since 2024). Every median therefore carries its
transaction count, the UI says "from just 1 rental, salt to taste", "cheapest first" ignores medians
backed by fewer than 3 deals, and the Fair Price Check needs at least 5 comparable deals, widening
from block to street to town until it has them.

**Duplicate rows.** The median rent file repeats every 2020-Q1 row verbatim; rows are deduplicated by
(quarter, town, flat type).

**Station codes instead of names.** 17 MRT exits are labelled with a station code (e.g. `NE18`)
instead of a name, mostly at stations opened since 2024. The 7 codes present are mapped to names.
LRT stations are labelled as LRT.

**Stale or not-yet-open places.** The community club layer includes closed temporary premises
("Thomson CC (Till 1Q 2022)") and unbuilt ones ("(Pending U/C)"); these are dropped.

**Lost characters.** Some MOE programme names contain U+FFFD (a character lost before publication).
Between spaces it was a dash and is shown as a colon; elsewhere it was an apostrophe.

**Preschool vacancies are categories, not counts** (Available, Limited, Full, Not Applicable),
relative to the month the file is published. Each centre also has its own `last_updated`, from
January to October 2026 in the current file; listings more than three months older than the file are
flagged as possibly stale. 171 centres in the ECDA listing match neither the location layer nor an
HDB postal code and are left out.

**Unusable datasets.** "Flood Prone Areas" sounds useful but is 4 rows of total hectares per year, with
no locations, so it is not used.

## Methods and their limits

- **Distances** are straight-line from the block's footprint centre. Walking routes are longer.
  Walking minutes assume 80 m a minute.
- **Lease left** assumes the lease starts on 1 January of the commencement year (HDB publishes only the
  year), so it can overstate the remainder by up to a year. Blocks with no resale use their
  completion year.
- **Land use within 500 m** is estimated on a 50 m grid (about 315 sample points per block), each point
  standing for 2,500 m². Roads are excluded.
- **Medians** cover the 12 months up to the latest month in the data, not up to today, so an older
  snapshot stays self-consistent.
- **Playground and fitness corner counts** cover NParks-managed spaces only; many HDB estates have
  their own playgrounds that are not in this data.
- **Insights are descriptive, not causal.** The "school premium" and "lease decay" charts mix location
  effects (older towns have more schools and older flats); the page says so next to each chart.
