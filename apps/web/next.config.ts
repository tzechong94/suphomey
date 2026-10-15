import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// Local development keeps one .env at the repo root (shared with the ingest CLIs).
// On Vercel there is no file and variables come from the project settings.
const rootEnv = path.resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them.
  transpilePackages: ['@suphomey/core', '@suphomey/db', '@suphomey/ingest'],
  // The Docker image (and only it: Vercel and `next start` don't need it) runs from the
  // self-contained "standalone" output. Tracing starts at the monorepo root so the
  // workspace packages are included.
  ...(process.env.NEXT_STANDALONE === '1' && { output: 'standalone' as const }),
  outputFileTracingRoot: path.resolve(import.meta.dirname, '../..'),
};

export default nextConfig;
