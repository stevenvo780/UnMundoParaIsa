import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    open: false,
    host: true, // Listen on all addresses for Docker
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
