import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Hasil build masuk ke folder ../dhasil di root repo, jadi bisa diakses di
// https://jundicomp.github.io/rsppp/dhasil/ tanpa menyentuh index.html di root.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../dhasil',
    emptyOutDir: true
  }
});
