import { createCanvas, get2d } from '../lib/dom';
import { pickVideoMime } from '../lib/mime';
import { startTicker } from '../lib/ticker';
import { attachVideo, getDisplayStream, stopStream } from './display';

export type WebcamPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface RecordingOptions {
  microphone: boolean;
  systemAudio: boolean;
  webcam: boolean;
  webcamPosition: WebcamPosition;
  fps: number;
}

export interface RecordingResult {
  blob: Blob;
  width: number;
  height: number;
  durationMs: number;
}

export type RecorderState = 'idle' | 'recording' | 'paused';

/**
 * Screen recorder: display stream + optional mic/system audio mix + optional
 * webcam bubble composited onto a canvas, encoded with MediaRecorder.
 */
export class ScreenRecorder {
  state: RecorderState = 'idle';
  onStop?: (result: RecordingResult) => void;

  private streams: MediaStream[] = [];
  private cleanups: Array<() => void> = [];
  private recorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private size = { width: 0, height: 0 };
  private startedAt = 0;
  private pausedTotal = 0;
  private pausedAt = 0;

  constructor(private readonly opts: RecordingOptions) {}

  get elapsedMs(): number {
    if (this.state === 'idle') return 0;
    const pausedNow = this.state === 'paused' ? performance.now() - this.pausedAt : 0;
    return performance.now() - this.startedAt - this.pausedTotal - pausedNow;
  }

  /** Opens the picker and prepares sources. Call `begin()` after any countdown. */
  async prepare(): Promise<void> {
    const display = await getDisplayStream({ audio: this.opts.systemAudio, frameRate: this.opts.fps });
    this.streams.push(display);

    const [screenTrack] = display.getVideoTracks();
    // "Stop sharing" in the browser UI ends the recording, like CleanShot's menu-bar stop.
    screenTrack.addEventListener('ended', () => void this.stop());

    const videoTrack = this.opts.webcam ? await this.compositeWithWebcam(display) : screenTrack;
    const audioTracks = await this.mixAudio(display);
    const settings = screenTrack.getSettings();
    this.size = { width: settings.width ?? 0, height: settings.height ?? 0 };

    const mimeType = pickVideoMime();
    this.recorder = new MediaRecorder(new MediaStream([videoTrack, ...audioTracks]), {
      mimeType,
      videoBitsPerSecond: 8_000_000,
    });
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
  }

  begin(): void {
    if (!this.recorder) throw new Error('Call prepare() first');
    this.recorder.start(1_000);
    this.startedAt = performance.now();
    this.state = 'recording';
  }

  pause(): void {
    if (this.state !== 'recording' || !this.recorder) return;
    this.recorder.pause();
    this.pausedAt = performance.now();
    this.state = 'paused';
  }

  resume(): void {
    if (this.state !== 'paused' || !this.recorder) return;
    this.recorder.resume();
    this.pausedTotal += performance.now() - this.pausedAt;
    this.state = 'recording';
  }

  async stop(): Promise<RecordingResult | null> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      this.dispose();
      return null;
    }

    const durationMs = this.elapsedMs;
    const stopped = new Promise<void>((resolve) => recorder.addEventListener('stop', () => resolve(), { once: true }));
    recorder.stop();
    await stopped;
    this.dispose();

    const result: RecordingResult = {
      blob: new Blob(this.chunks, { type: recorder.mimeType }),
      durationMs,
      ...this.size,
    };
    this.onStop?.(result);
    return result;
  }

  /** Discards everything without producing a file. */
  cancel(): void {
    this.onStop = undefined;
    if (this.recorder?.state !== 'inactive') this.recorder?.stop();
    this.dispose();
  }

  private dispose(): void {
    this.state = 'idle';
    this.cleanups.splice(0).forEach((fn) => fn());
    this.streams.splice(0).forEach(stopStream);
  }

  private async mixAudio(display: MediaStream): Promise<MediaStreamTrack[]> {
    const sources = [...display.getAudioTracks()];

    if (this.opts.microphone) {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      this.streams.push(mic);
      sources.push(...mic.getAudioTracks());
    }

    if (sources.length <= 1) return sources;

    // MediaRecorder records one audio track, so mix system + mic in Web Audio.
    const ctx = new AudioContext();
    const destination = ctx.createMediaStreamDestination();
    for (const track of sources) {
      ctx.createMediaStreamSource(new MediaStream([track])).connect(destination);
    }
    this.cleanups.push(() => void ctx.close());
    return destination.stream.getAudioTracks();
  }

  private async compositeWithWebcam(display: MediaStream): Promise<MediaStreamTrack> {
    const camera = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    this.streams.push(camera);

    const [screen, cam] = await Promise.all([attachVideo(display), attachVideo(camera)]);
    const canvas = createCanvas(screen.videoWidth, screen.videoHeight);
    const ctx = get2d(canvas);

    const draw = () => {
      if (canvas.width !== screen.videoWidth || canvas.height !== screen.videoHeight) {
        canvas.width = screen.videoWidth;
        canvas.height = screen.videoHeight;
      }
      ctx.drawImage(screen, 0, 0);
      drawWebcamBubble(ctx, cam, canvas.width, canvas.height, this.opts.webcamPosition);
    };

    const stopTicker = startTicker(this.opts.fps, draw);
    this.cleanups.push(stopTicker, () => {
      screen.srcObject = null;
      cam.srcObject = null;
    });

    return canvas.captureStream(this.opts.fps).getVideoTracks()[0];
  }
}

function drawWebcamBubble(
  ctx: CanvasRenderingContext2D,
  cam: HTMLVideoElement,
  width: number,
  height: number,
  position: WebcamPosition,
): void {
  const size = Math.round(Math.min(width, height) * 0.24);
  const margin = Math.round(size * 0.15);
  const x = position.endsWith('right') ? width - size - margin : margin;
  const y = position.startsWith('bottom') ? height - size - margin : margin;

  // Center-crop the camera frame to a square, mirrored like a selfie view.
  const side = Math.min(cam.videoWidth, cam.videoHeight);
  const sx = (cam.videoWidth - side) / 2;
  const sy = (cam.videoHeight - side) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.lineWidth = Math.max(3, size * 0.025);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  ctx.clip();
  ctx.translate(x + size, y);
  ctx.scale(-1, 1);
  ctx.drawImage(cam, sx, sy, side, side, 0, 0, size, size);
  ctx.restore();
}
