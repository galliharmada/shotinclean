type Child = Node | string | number | null | undefined | false;
type AttrValue = string | number | boolean | EventListener | undefined;

/** Tiny hyperscript helper: `h('button', { class: 'btn', onclick }, 'Save')`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'class') {
      el.className = String(value);
    } else if (key in el && typeof value !== 'string') {
      // Properties such as `checked`, `value`, `disabled` on inputs.
      (el as unknown as Record<string, unknown>)[key] = value;
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }

  return el;
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  return ctx;
}

export const canvasToBlob = (canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))), type),
  );

export async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const canvas = createCanvas(bitmap.width, bitmap.height);
  get2d(canvas).drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Async Clipboard only accepts PNG for images, so re-encode anything else. */
export async function copyImage(blob: Blob): Promise<void> {
  const png = blob.type === 'image/png' ? blob : await canvasToBlob(await blobToCanvas(blob));
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

/** CleanShot-style file name: "ShotInClean 2026-10-21 at 09.41.07.png". */
export function timestampName(ext: string, date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`;
  return `ShotInClean ${day} at ${time}.${ext}`;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
