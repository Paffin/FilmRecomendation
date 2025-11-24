import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  // @ts-expect-error Vitest config field
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
