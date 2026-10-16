import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Hasil build masuk ke folder ../c1 di root repo, jadi bisa diakses di
// https://jundicomp.github.io/rsppp/c1/ tanpa menyentuh index.html di root.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../c1',
    emptyOutDir: true
  }
});
