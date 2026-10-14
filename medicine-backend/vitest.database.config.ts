import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),

  test: {
    environment: 'node',
    globals: false,
    passWithNoTests: false,

    include: [
      'tests/database/**/*.test.ts',
    ],

    exclude: [
      ...configDefaults.exclude,
      'tests/helpers/**',
    ],
  },
});