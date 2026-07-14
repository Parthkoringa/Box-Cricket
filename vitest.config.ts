import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/_test/**/*.test.ts'],
    setupFiles: ['api/_test/setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
