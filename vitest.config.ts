import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Tests that spawn git are slow on Windows under a full parallel run; the 5s default is not enough there.
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node', testTimeout: 20_000 },
});
