import type { Rect } from '../lib/geometry';

export type BackgroundFill =
  | { kind: 'gradient'; from: string; to: string; angle: number }
  | { kind: 'solid'; color: string }
  | { kind: 'transparent' };

export type AspectRatio = 'auto' | '1:1' | '4:3' | '16:9' | '9:16';

export interface BackgroundOptions {
  enabled: boolean;
  fill: BackgroundFill;
  padding: number;
  radius: number;
  shadow: number;
  aspect: AspectRatio;
}

export interface BackgroundLayout {
  width: number;
  height: number;
  /** Where the screenshot sits inside the output, at 1:1 scale. */
  image: Rect;
}

export const GRADIENTS: ReadonlyArray<Extract<BackgroundFill, { kind: 'gradient' }>> = [
  { kind: 'gradient', from: '#ff5f6d', to: '#ffc371', angle: 135 },
  { kind: 'gradient', from: '#4facfe', to: '#00f2fe', angle: 135 },
  { kind: 'gradient', from: '#a18cd1', to: '#fbc2eb', angle: 135 },
  { kind: 'gradient', from: '#43e97b', to: '#38f9d7', angle: 135 },
  { kind: 'gradient', from: '#0f2027', to: '#2c5364', angle: 135 },
  { kind: 'gradient', from: '#f857a6', to: '#ff5858', angle: 135 },
];

export const DEFAULT_BACKGROUND: BackgroundOptions = {
  enabled: false,
  fill: GRADIENTS[1],
  padding: 64,
  radius: 12,
  shadow: 30,
  aspect: 'auto',
};

const ASPECTS: Record<Exclude<AspectRatio, 'auto'>, number> = {
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
};

/**
 * Pure layout math for the background tool: pad the image, then grow the
 * shorter side until the requested aspect ratio is met. The image is never scaled.
 */
export function computeLayout(imgW: number, imgH: number, opts: BackgroundOptions): BackgroundLayout {
  if (!opts.enabled) {
    return { width: imgW, height: imgH, image: { x: 0, y: 0, width: imgW, height: imgH } };
  }

  let width = imgW + opts.padding * 2;
  let height = imgH + opts.padding * 2;

  if (opts.aspect !== 'auto') {
    const ratio = ASPECTS[opts.aspect];
    if (width / height < ratio) width = height * ratio;
    else height = width / ratio;
  }

  width = Math.round(width);
  height = Math.round(height);

  return {
    width,
    height,
    image: {
      x: Math.round((width - imgW) / 2),
      y: Math.round((height - imgH) / 2),
      width: imgW,
      height: imgH,
    },
  };
}

export function fillStyleFor(
  ctx: CanvasRenderingContext2D,
  fill: BackgroundFill,
  width: number,
  height: number,
): string | CanvasGradient | null {
  switch (fill.kind) {
    case 'transparent':
      return null;
    case 'solid':
      return fill.color;
    case 'gradient': {
      const rad = (fill.angle * Math.PI) / 180;
      const half = (Math.abs(width * Math.sin(rad)) + Math.abs(height * Math.cos(rad))) / 2;
      const cx = width / 2;
      const cy = height / 2;
      const dx = Math.sin(rad) * half;
      const dy = -Math.cos(rad) * half;
      const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      gradient.addColorStop(0, fill.from);
      gradient.addColorStop(1, fill.to);
      return gradient;
    }
  }
}

/** Paints the backdrop and the drop shadow; the caller draws the image on top. */
export function paintBackground(
  ctx: CanvasRenderingContext2D,
  layout: BackgroundLayout,
  opts: BackgroundOptions,
): void {
  if (!opts.enabled) return;

  const style = fillStyleFor(ctx, opts.fill, layout.width, layout.height);
  if (style) {
    ctx.fillStyle = style;
    ctx.fillRect(0, 0, layout.width, layout.height);
  }

  if (opts.shadow > 0) {
    const { x, y, width, height } = layout.image;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = opts.shadow;
    ctx.shadowOffsetY = opts.shadow / 3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, opts.radius);
    ctx.fill();
    ctx.restore();
  }
}

/** Clips subsequent drawing to the image's rounded corners. */
export function clipImage(ctx: CanvasRenderingContext2D, layout: BackgroundLayout, opts: BackgroundOptions): void {
  if (!opts.enabled || opts.radius <= 0) return;
  const { x, y, width, height } = layout.image;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, opts.radius);
  ctx.clip();
}
