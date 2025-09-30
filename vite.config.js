import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        globals: {
          d3: 'd3'
        }
      }
    }
  },
  esbuild: {
    target: 'es2020'
  },
  optimizeDeps: {
    exclude: ['d3']
  },
  define: {
    global: 'window'
  }
});
