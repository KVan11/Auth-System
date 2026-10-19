import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),

  test: {
    environment: 'node',
    globals: false,
    passWithNoTests: false,

    include: [
      'tests/**/*.test.ts',
    ],

    exclude: [
      ...configDefaults.exclude,
      'tests/**/*.integration.test.ts',
    ],
  },
});
