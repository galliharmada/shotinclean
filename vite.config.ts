import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// OCR runs fully offline: the Tesseract worker, WASM core and English model
// are served from /tesseract instead of a third-party CDN, so captured
// screenshots never trigger network requests.
const tesseractAssets = viteStaticCopy({
  targets: [
    { src: 'node_modules/tesseract.js/dist/worker.min.js', dest: 'tesseract' },
    { src: 'node_modules/tesseract.js-core/tesseract-core-*lstm.wasm.js', dest: 'tesseract' },
    { src: 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', dest: 'tesseract' },
  ],
});

export default defineConfig({
  plugins: [tesseractAssets],
  // Marketing shots are written here by scripts/marketing-shots.mjs while the
  // dev server runs; do not treat those writes as an app change.
  server: { watch: { ignored: ['**/src/landing/assets/**'] } },
  build: { target: 'es2022' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as never);
