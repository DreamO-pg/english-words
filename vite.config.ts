import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base — под GitHub Pages: https://<user>.github.io/english-words/
// В dev-режиме страница открывается по http://localhost:5173/english-words/
export default defineConfig({
  plugins: [react()],
  base: '/english-words/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
