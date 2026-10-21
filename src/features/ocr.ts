/**
 * Text recognition (CleanShot's "Capture Text"). Tesseract.js is loaded on
 * first use so it doesn't weigh down the initial bundle. Its worker, WASM core
 * and English model are self-hosted under /tesseract (see vite.config.ts).
 */
// Absolute, because Tesseract boots its worker from a blob: URL where relative paths don't resolve.
const ASSETS = new URL(`${import.meta.env.BASE_URL}tesseract`, location.href).href;

export async function recognizeText(image: HTMLCanvasElement, onProgress?: (pct: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: `${ASSETS}/worker.min.js`,
    corePath: ASSETS,
    langPath: ASSETS,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(Math.round(m.progress * 100));
    },
  });

  try {
    const { data } = await worker.recognize(image);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
