import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { createCanvas } from '../lib/dom';

export const seek = (video: HTMLVideoElement, time: number): Promise<void> =>
  new Promise((resolve) => {
    video.addEventListener('seeked', () => resolve(), { once: true });
    video.currentTime = time;
  });

/**
 * MediaRecorder WebM files have no duration header, so `video.duration` is
 * Infinity until the browser scans to the end. Seeking far forces that scan.
 */
export async function loadVideo(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.src = src;
  await new Promise<void>((resolve, reject) => {
    video.addEventListener('loadedmetadata', () => resolve(), { once: true });
    video.addEventListener('error', () => reject(new Error('Could not load video')), { once: true });
  });

  if (!Number.isFinite(video.duration)) {
    await new Promise<void>((resolve) => {
      const onChange = () => {
        if (!Number.isFinite(video.duration)) return;
        video.removeEventListener('durationchange', onChange);
        resolve();
      };
      video.addEventListener('durationchange', onChange);
      video.currentTime = 1e9;
    });
    await seek(video, 0);
  }

  return video;
}

export interface GifOptions {
  start: number;
  end: number;
  fps: number;
  maxWidth: number;
  onProgress?: (fraction: number) => void;
}

/** Encodes a section of a video into an optimized GIF, frame by frame. */
export async function videoToGif(video: HTMLVideoElement, opts: GifOptions): Promise<Blob> {
  const scale = Math.min(1, opts.maxWidth / video.videoWidth);
  const canvas = createCanvas(video.videoWidth * scale, video.videoHeight * scale);
  // `willReadFrequently` keeps the canvas CPU-side for the getImageData loop.
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  ctx.imageSmoothingQuality = 'high';

  const gif = GIFEncoder();
  const delay = Math.round(1000 / opts.fps);
  const total = Math.max(1, Math.ceil((opts.end - opts.start) * opts.fps));

  for (let i = 0; i < total; i++) {
    await seek(video, Math.min(opts.end, opts.start + i / opts.fps));
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, { palette, delay });
    opts.onProgress?.((i + 1) / total);
  }

  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

/**
 * Trims by replaying the selected range into a MediaRecorder. It runs in
 * real time, which is fine for typical short screen clips and needs no
 * ffmpeg.wasm download.
 */
export async function trimVideo(
  video: HTMLVideoElement,
  start: number,
  end: number,
  mimeType: string,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  await seek(video, start);
  const stream = (video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const done = new Promise<void>((resolve) => recorder.addEventListener('stop', () => resolve(), { once: true }));
  recorder.start();
  await video.play();

  await new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      video.removeEventListener('ended', finish);
      resolve();
    };
    // Frame callbacks stop once playback ends, so `ended` covers trims that run to the end.
    const onFrame = () => {
      if (finished) return;
      onProgress?.(Math.min(1, (video.currentTime - start) / (end - start)));
      if (video.currentTime >= end) return finish();
      video.requestVideoFrameCallback(onFrame);
    };
    video.addEventListener('ended', finish);
    video.requestVideoFrameCallback(onFrame);
  });

  video.pause();
  recorder.stop();
  await done;
  return new Blob(chunks, { type: recorder.mimeType });
}
