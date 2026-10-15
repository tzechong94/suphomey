# Deployment

Two targets, same code. The app reads only `DATABASE_URL` and `CRON_SECRET`.

- **Vercel + Neon:** the live demo. Steps below.
- **AWS:** fully described in code with CDK. See [infra/README.md](../infra/README.md).

## Vercel + Neon

### 1. Database (Neon)

1. Create a Neon project in **AWS Asia Pacific (Singapore)**, the same region the Vercel functions
   run in (`sin1` in `apps/web/vercel.json`). Cross-region queries add about 200 ms each.
2. From the Neon console, copy two connection strings:
   - **Direct** (host without `-pooler`): for migrations and seeding from your machine.
   - **Pooled** (host contains `-pooler`): for the app on Vercel. Serverless functions open many
     short-lived connections, and Neon's pooler (PgBouncer) absorbs them.
3. Load the schema and data from your machine, using the direct string:

   ```bash
   DATABASE_URL='postgres://...direct...' pnpm db:migrate
   DATABASE_URL='postgres://...direct...' pnpm db:seed
   ```

   The seed is about 1.1 million rows and takes a few minutes over the internet. The database ends up
   around 140 MB.

### 2. App (Vercel, Hobby plan)

The repo is a pnpm monorepo; the Vercel project points at `apps/web` and builds the workspace from the
repo root.

```bash
npm i -g vercel            # or use npx vercel
vercel login
vercel link                # from the repo root; create a new project
```

In the Vercel dashboard, under **Settings > Build and Deployment**, set **Root Directory** to
`apps/web` and **Node.js Version** to 22.x. Leave the framework (Next.js) and build commands on their
defaults.

Add the environment variables (Production, and Preview if you use it):

```bash
vercel env add DATABASE_URL production   # the Neon *pooled* connection string
vercel env add CRON_SECRET production    # any long random string, e.g. openssl rand -hex 32
```

Deploy from the repo root:

```bash
vercel deploy --prod
```

### 3. Daily refresh (Vercel Cron)

`apps/web/vercel.json` registers five cron jobs, one per dataset, between 03:00 and 07:00 Singapore
time. Vercel sends `Authorization: Bearer $CRON_SECRET`; requests without it get a 401. Crons only run
on production deployments, and the Hobby plan runs them once a day at a time within the hour (each job
takes under 15 s against the 300 s limit).

Check on them at `/api/health`, which lists the last run of each job, or trigger one by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.vercel.app/api/cron/rentals
```

### What does not run on Vercel, and why

`pnpm locate-blocks` and `pnpm build-seed` stay on a developer machine: they read a 189 MB Master Plan
file and a 57 MB building footprint file that change a few times a year, which suits neither a daily
cron nor a 2 GB serverless function. Their output is committed in `data/seed`. Blocks that appear in
new transactions between seed builds are still added by the daily refresh, without coordinates until
the next build.
