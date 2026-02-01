import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@ui': path.resolve(__dirname, 'src/renderer')
    }
  },
  server: {
    port: 3000,
    strictPort: false
  },
  test: {
    include: ['../../src/**/*.{test,spec}.{ts,tsx}'],
    globals: true
  }
});
