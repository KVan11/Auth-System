import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),

  test: {
    environment: 'node',
    globals: false,
    passWithNoTests: false,

    include: [
      'tests/config/**/*.test.ts',
      'tests/api/**/*.test.ts',
      'tests/auth/**/*.test.ts',
      'tests/lifecycle/**/*.test.ts',
      'tests/security/**/*.test.ts',
      'tests/extension/**/*.test.ts',
    ],

    exclude: [
      ...configDefaults.exclude,
      'tests/database/**',
      'tests/authority/**',
      'tests/helpers/**',
    ],
  },
});