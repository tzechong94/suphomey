import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Refresh tests start an in-memory Postgres (PGlite) per test.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
