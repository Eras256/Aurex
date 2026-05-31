import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    alias: {
      '@arbitrage/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@arbitrage/config': path.resolve(__dirname, '../../packages/config/src/index.ts'),
      '@arbitrage/testing': path.resolve(__dirname, '../../packages/testing/src/index.ts'),
    },
  },
});
