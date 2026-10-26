import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

// `npm test`: test đơn vị/API; `npm run test:integration` (--mode integration): test với database thật
export default defineConfig(({ mode }) => {
  const integration = mode === 'integration';

  return {
    root: fileURLToPath(new URL('.', import.meta.url)),

    test: {
      environment: 'node',
      globals: false,
      passWithNoTests: false,

      include: integration ? ['tests/**/*.integration.test.ts'] : ['tests/**/*.test.ts'],

      exclude: [
        ...configDefaults.exclude,
        ...(integration ? [] : ['tests/**/*.integration.test.ts']),
      ],
    },
  };
});
