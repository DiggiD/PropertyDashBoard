import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist'
  },
  esbuild: {
    target: 'es2020'
  },
  define: {
    global: 'window'
  }
});
