import { cropCanvas } from '../capture/areaSelect';
import { computeLayout } from '../editor/background';
import { composeImage } from '../editor/compose';
import { recognizeText } from '../features/ocr';
import { blobToCanvas, canvasToBlob, createCanvas, get2d } from '../lib/dom';
import { clampRect, roundRect } from '../lib/geometry';
import { framesToGif, loadVideo, videoToGif } from '../video/media';
import { type RenderSpec, normalizeSpec } from './spec';

/**
 * Headless engine page (headless.html). The CLI drives it with Playwright:
 * inputs arrive as URLs served by the CLI, outputs return as base64.
 * Everything runs through the same code paths as the interactive app.
 */

async function loadImage(url: string): Promise<HTMLCanvasElement> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}: ${res.status}`);
  return blobToCanvas(await res.blob());
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export interface RenderResult {
  png: string;
  width: number;
  height: number;
}

async function render(imageUrl: string, spec: RenderSpec): Promise<RenderResult> {
  const image = await loadImage(imageUrl);
  const { crop, shapes, background } = normalizeSpec(spec, image.width, image.height);
  const bounds = { x: 0, y: 0, width: image.width, height: image.height };
  const source = crop ? cropCanvas(image, roundRect(clampRect(crop, bounds))) : image;

  const layout = computeLayout(source.width, source.height, background);
  const out = createCanvas(layout.width, layout.height);
  composeImage(get2d(out), source, shapes, background, layout);

  return { png: await toBase64(await canvasToBlob(out)), width: out.width, height: out.height };
}

async function ocr(imageUrl: string): Promise<string> {
  return recognizeText(await loadImage(imageUrl));
}

export interface GifRequest {
  start?: number;
  end?: number;
  fps?: number;
  width?: number;
}

async function gif(videoUrl: string, req: GifRequest = {}): Promise<{ gif: string; frames: number }> {
  const video = await loadVideo(videoUrl);
  const start = Math.max(0, req.start ?? 0);
  const end = Math.min(video.duration, req.end ?? video.duration);
  if (end <= start) throw new Error(`Empty range: start ${start}s ≥ end ${end}s (video is ${video.duration.toFixed(2)}s)`);

  const fps = req.fps ?? 12;
  const blob = await videoToGif(video, { start, end, fps, maxWidth: req.width ?? 800 });
  return { gif: await toBase64(blob), frames: Math.ceil((end - start) * fps) };
}

async function gifFromFrames(frames: Array<{ url: string; delayMs: number }>, maxWidth = 800): Promise<{ gif: string }> {
  const images = await Promise.all(
    frames.map(async (f) => ({ image: await createImageBitmap(await (await fetch(f.url)).blob()), delayMs: f.delayMs })),
  );
  const blob = framesToGif(images, maxWidth);
  images.forEach((f) => f.image.close());
  return { gif: await toBase64(blob) };
}

const api = { version: 1, render, ocr, gif, gifFromFrames };

declare global {
  interface Window {
    shotinclean: typeof api;
  }
}

window.shotinclean = api;
