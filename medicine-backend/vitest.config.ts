import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Chạy test trong tests/ (không cần database thật)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
