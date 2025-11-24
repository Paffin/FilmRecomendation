import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // @ts-expect-error Vitest config field
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
