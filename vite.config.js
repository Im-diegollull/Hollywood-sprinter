import { defineConfig } from 'vite';

// base relativo: necesario para itch.io (zip) y cómodo para GitHub Pages
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
