import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/test/**/*.test.ts'],
    setupFiles: ['api/test/setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
