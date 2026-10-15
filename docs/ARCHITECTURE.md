# suphomey architecture

suphomey helps people choose an HDB flat to rent or buy. It joins about 30 data.gov.sg datasets
into a single profile per HDB block, then lets users explore blocks on a map, check whether a
price is fair, and compare renting with buying.

## Guiding decision: do the spatial work once, at ingestion

Almost every question the UI asks is spatial ("is there an MRT exit within 800 m?", "which
primary schools are within 1 km?"). The HDB block list is small (about 11,000 residential
blocks) and amenities rarely move, so all distance work is precomputed by the ingestion
pipeline and stored in plain tables. Requests then only read indexed rows.

Rejected alternative: PostGIS with runtime `ST_DWithin` queries. It is the textbook answer, but
it needs a spatial extension in every environment (Neon, RDS, local, tests). Our in-process
test database (PGlite) cannot load it, and at this data size precomputation in TypeScript
(a k-d tree over amenity points) takes seconds.

## System overview

```
                 data.gov.sg (CSV / GeoJSON / live APIs)
                    |                 |                  |
       one-off, local:           daily, Vercel Cron:     live, per request:
  pnpm build-seed               /api/cron/[job]          carpark availability
  (geocode, Master Plan,        (resale, rentals,        (60 s CDN cache)
   footprints, distances)        vacancies, dengue,
          |                      closures, upgrading)
          v                              |
   data/seed/*.csv.gz  --seed-->  PostgreSQL (Neon / RDS / Docker)
     (committed)                         |
                                  packages/db queries
                                         |
                       Next.js route handlers (apps/web/app/api)
                                         |
                       React UI (map, block page, price check, ...)
                       scoring + finance maths from packages/core
```

## Packages

| Package | Responsibility | Depends on |
|---|---|---|
| `packages/core` | Pure domain logic: address normalisation, match scoring, price percentiles and verdicts, rent vs buy, lease maths. No I/O. | zod |
| `packages/db` | Drizzle schema, migrations, typed query functions. | core |
| `packages/ingest` | Download, parse, validate, geocode, compute distances, load. CLI entry points plus the functions the cron routes call. | core, db |
| `apps/web` | Next.js App Router: pages, components, thin API route handlers. | core, db, ingest (cron only) |
| `infra` | AWS CDK app describing the production deployment on AWS. | |
| `e2e` | Playwright smoke tests against a running app. | |

Rule: route handlers parse input with Zod, call one query or core function, and shape the
response. Business rules live in `core`, so they are unit tested without a database or browser.

## Data pipeline

| Stage | Where it runs | Datasets | Why there |
|---|---|---|---|
| Locate blocks | Locally (`pnpm locate-blocks`) | Resale, rentals, HDB Property Information, HDB building footprints | Rent and resale rows have no coordinates. Blocks are matched to HDB building footprints (one OneMap lookup per ambiguous street, cached and committed), so the app never depends on OneMap. See [DATA.md](DATA.md). |
| Spatial build | Locally (`pnpm build-seed`) | Everything static: amenities, Master Plan 2025, upgrading, boundaries | The Master Plan file is 189 MB; it changes a few times a year, not daily. |
| Seed | Anywhere (`pnpm db:seed`) | `data/seed` | Lets the app run offline with no API keys. |
| Daily refresh | Vercel Cron (one job per dataset), or EventBridge on AWS | Resale, rentals, preschool vacancies, dengue clusters, hawker closures | Small, incremental, well under the 300 s Hobby limit. |

Incremental loads: transaction datasets are append-mostly but late registrations land in recent
months. Each refresh deletes and reloads only the latest three months, inside one transaction,
which keeps the job idempotent and small.

Every run writes a row to `ingestion_runs` (dataset, status, row count, error), which backs
`/api/health` and makes stale data visible. Refresh jobs take a fetch function as a parameter, so
tests run them against fixture files with no network.

## Data model

| Table | Grain | Notes |
|---|---|---|
| `blocks` | One per HDB block | Key `"<block>|<street>"`, coordinates, year completed, lease start, max floor, unit mix, planning area. |
| `resale_transactions` | One per resale | Month, flat type, storey range, floor area, price. |
| `rental_transactions` | One per approved rental | Month, flat type, monthly rent. |
| `amenities` | One per place | `kind` (mrt_exit, hawker, primary_school, preschool, clinic, park, carpark, ...), name, coordinates, `details` JSON (vacancies, closures, fees). |
| `block_amenities` | Block x nearby amenity | Distance in metres, only within a per-kind radius. |
| `block_summary` | One per block | Denormalised: nearest distances, counts, 12-month medians and how many deals each median is based on. Feeds the map and scoring. |
| `block_land_use` | Block x land-use type | Area of each Master Plan 2025 zone within 500 m. |
| `block_programmes` | Block x upgrading programme | Lift upgrading / neighbourhood renewal status. |
| `risk_areas` | One per polygon | Current dengue clusters and high-Aedes areas (GeoJSON). |
| `town_stats` | Quarter x town x flat type | Median rent and resale, BTO price ranges, resale index (for insights). |
| `ingestion_runs` | One per pipeline run | Observability. |

## API

| Route | Purpose | Caching |
|---|---|---|
| `GET /api/blocks` | Compact data for every block (map + client-side scoring) | CDN, 1 h |
| `GET /api/blocks/search?q=` | Autocomplete by block, street or postal code | CDN, 1 h |
| `GET /api/blocks/:id` | Full block profile | CDN, 1 h |
| `GET /api/blocks/:id/transactions?kind=&flatType=` | Price history | CDN, 1 h |
| `GET /api/price-check?blockId=&kind=&flatType=&amount=` | Percentile and verdict | CDN, 1 h |
| `GET /api/carparks/live?ids=` | Live lots from data.gov.sg | CDN, 60 s |
| `GET /api/insights/:name` | Precomputed insight series | CDN, 1 h |
| `GET /api/cron/:job` | Refresh one dataset (Bearer `CRON_SECRET`) | none |
| `GET /api/health` | DB reachable + last successful run per dataset | none |

Scoring runs in the browser using `packages/core`, so toggling a preference chip re-ranks 11,000
blocks instantly without a round trip. The same function is unit tested in `core`.

## Deployment targets

| Concern | Vercel (live demo) | AWS (infra/, CDK) |
|---|---|---|
| Web + API | Vercel Functions | ECS Fargate behind an ALB |
| CDN | Vercel Edge Network | CloudFront |
| Database | Neon Postgres (pooled connection) | RDS PostgreSQL in private subnets |
| Secrets | Vercel environment variables | Secrets Manager |
| Daily refresh | Vercel Cron | EventBridge Scheduler -> ECS task |
| Logs and alarms | Vercel logs | CloudWatch |

The app reads only `DATABASE_URL` (or the standard `PG*` variables) and `CRON_SECRET`, so the
same code runs on both. On AWS:

- **Network:** two AZs; the load balancer in public subnets accepts traffic only from CloudFront's
  origin-facing prefix list; app and ingest tasks in private subnets with one NAT gateway (for
  data.gov.sg); Postgres in isolated subnets, reachable only from the two task security groups.
- **Secrets:** RDS generates the database password into Secrets Manager; ECS injects it as `PG*`
  variables. Connections use `PGSSLMODE=verify-full` with Amazon's RDS CA bundled in the image, so TLS
  is verified, not just enabled.
- **Deploys:** rolling, with the circuit breaker rolling back failed deployments and capacity never
  dropping below 100%.
- **Schedule:** EventBridge Scheduler runs the ingest image daily at 03:00 Singapore time, migrating
  first, with two retries.
- **Alarms:** target 5xx errors, unhealthy tasks, database CPU and free storage, to an SNS topic.

## Testing strategy

| Layer | Tool | What it proves |
|---|---|---|
| Domain (`core`) | Vitest | Scoring, percentiles, rent vs buy and lease maths on hand-checked numbers. |
| Ingestion | Vitest + real sample rows | Parsers survive the messy values found in the real files (`na`, `-`, odd casing). |
| Database queries + API | Vitest + PGlite | Queries and route handlers against real Postgres semantics, no server needed. |
| Components | Vitest + Testing Library | Chips, match bar and price verdict behave correctly. |
| End to end | Playwright | The main journeys work in a real browser. |
| Infrastructure | CDK assertions | Database is private, secrets are not hardcoded, schedule exists. |
