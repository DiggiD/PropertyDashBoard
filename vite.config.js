import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

function resolveJsToTs() {
    return {
        name: 'resolve-js-to-ts',
        enforce: 'pre',
        async resolveId(source, importer) {
            if (!importer || !source.endsWith('.js') || source.includes('node_modules')) {
                return null;
            }
            const abs = path.resolve(path.dirname(importer), source);
            if (fs.existsSync(abs)) {
                return null;
            }
            const asTs = abs.replace(/\.js$/, '.ts');
            if (fs.existsSync(asTs)) {
                return asTs;
            }
            return null;
        },
    };
}

export default defineConfig({
  base: './',
  plugins: [resolveJsToTs()],
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
