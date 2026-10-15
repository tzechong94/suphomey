# syntax=docker/dockerfile:1
# Two images from one build:
#   --target web     the Next.js app (Next "standalone" output), port 3000
#   --target ingest  migrations, seeding and the daily refresh jobs (pnpm scripts)

FROM node:22.18.0-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/ingest/package.json packages/ingest/
COPY infra/package.json infra/
COPY e2e/package.json e2e/
RUN pnpm install --frozen-lockfile

FROM deps AS source
COPY . .

FROM source AS build
RUN NEXT_STANDALONE=1 pnpm --filter web build

# Amazon RDS enforces TLS, and Node does not trust the RDS certificate authority by
# default. Bundling Amazon's CA certificates lets connections be verified, not just encrypted.
FROM base AS certs
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /certs/rds-global-bundle.pem

FROM node:22.18.0-alpine AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NODE_EXTRA_CA_CERTS=/certs/rds-global-bundle.pem
WORKDIR /app
COPY --from=certs /certs /certs
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]

FROM source AS ingest
ENV NODE_EXTRA_CA_CERTS=/certs/rds-global-bundle.pem
COPY --from=certs /certs /certs
USER node
# Default: bring the schema up to date, then run every refresh job.
CMD ["sh", "-c", "pnpm db:migrate && pnpm ingest"]
