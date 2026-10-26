import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Cấu hình riêng cho test; vite.config.ts (dev server, proxy /api) giữ nguyên
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
  },
})
