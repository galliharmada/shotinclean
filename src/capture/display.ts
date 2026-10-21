import { createCanvas, get2d } from '../lib/dom';

export interface DisplayStreamOptions {
  /** Ask for tab/system audio alongside video (Chromium only for system audio). */
  audio?: boolean;
  /** Hint which tab the picker should open on: screen, window or browser tab. */
  surface?: 'monitor' | 'window' | 'browser';
  frameRate?: number;
}

// Chromium-only extensions to DisplayMediaStreamOptions; ignored elsewhere.
interface ExtendedDisplayMediaOptions extends DisplayMediaStreamOptions {
  controller?: unknown;
  selfBrowserSurface?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
  systemAudio?: 'include' | 'exclude';
  monitorTypeSurfaces?: 'include' | 'exclude';
}

export function isCaptureSupported(): boolean {
  return Boolean(navigator.mediaDevices?.getDisplayMedia);
}

export async function getDisplayStream(opts: DisplayStreamOptions = {}): Promise<MediaStream> {
  if (!isCaptureSupported()) {
    throw new Error('Screen capture is not supported in this browser.');
  }

  const options: ExtendedDisplayMediaOptions = {
    video: { displaySurface: opts.surface, frameRate: opts.frameRate ?? 30 } as MediaTrackConstraints,
    audio: opts.audio ?? false,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
    systemAudio: opts.audio ? 'include' : 'exclude',
    monitorTypeSurfaces: 'include',
  };

  // When the user picks a window/tab, bring it to the front so ShotInClean
  // itself does not end up in the shot (the browser's take on CleanShot hiding its UI).
  const Controller = (globalThis as { CaptureController?: new () => { setFocusBehavior(b: string): void } })
    .CaptureController;
  const controller = Controller ? new Controller() : undefined;
  if (controller) options.controller = controller;

  const stream = await navigator.mediaDevices.getDisplayMedia(options);

  try {
    controller?.setFocusBehavior('focus-captured-surface');
  } catch {
    // Throws for full-screen captures or after the focus window has elapsed — harmless.
  }

  return stream;
}

export const stopStream = (stream: MediaStream): void => stream.getTracks().forEach((t) => t.stop());

export async function attachVideo(stream: MediaStream): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  await nextVideoFrame(video);
  return video;
}

/** Resolves once a real frame has been decoded (the first can be black). */
export const nextVideoFrame = (video: HTMLVideoElement): Promise<void> =>
  new Promise((resolve) => {
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => resolve());
    else setTimeout(resolve, 100);
  });

export function frameToCanvas(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = createCanvas(video.videoWidth, video.videoHeight);
  get2d(canvas).drawImage(video, 0, 0);
  return canvas;
}

/** Grabs a single frame from an already-granted stream. */
export async function grabFrame(stream: MediaStream): Promise<HTMLCanvasElement> {
  const video = await attachVideo(stream);
  await nextVideoFrame(video);
  const canvas = frameToCanvas(video);
  video.pause();
  video.srcObject = null;
  return canvas;
}
