import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests (and their setup hooks) that spawn git are slow on Windows under a full parallel run; the 5s/10s
  // defaults are not enough there, and one worker per core starves the git processes those tests spawn.
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 20_000,
    maxWorkers: process.platform === 'win32' ? '50%' : undefined,
  },
});
