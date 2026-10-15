import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // cdk.out holds a copy of the whole repo (the Docker build context); never run its tests.
    exclude: ['**/node_modules/**', 'cdk.out/**'],
    // Synthesising the stack takes a few seconds.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
