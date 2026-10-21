import { createCanvas, get2d } from '../lib/dom';
import { type Point, type Rect, containsPoint, distanceToSegment } from '../lib/geometry';

export type Tool =
  | 'select'
  | 'arrow'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'pen'
  | 'text'
  | 'highlight'
  | 'pixelate'
  | 'blur'
  | 'counter'
  | 'crop';

interface Base {
  id: string;
  color: string;
  size: number;
}

export type LineShape = Base & { type: 'arrow' | 'line'; from: Point; to: Point };
export type BoxShape = Base & { type: 'rect' | 'ellipse' | 'highlight' | 'pixelate' | 'blur'; rect: Rect };
export type PenShape = Base & { type: 'pen'; points: Point[] };
export type TextShape = Base & { type: 'text'; at: Point; text: string };
export type CounterShape = Base & { type: 'counter'; at: Point; n: number };

export type Shape = LineShape | BoxShape | PenShape | TextShape | CounterShape;

const HIT_TOLERANCE = 8;

export const newId = (): string => crypto.randomUUID();

export const fontSize = (size: number) => 14 + size * 4;
export const counterRadius = (size: number) => 12 + size * 2;
const font = (size: number) => `600 ${fontSize(size)}px ui-sans-serif, system-ui, -apple-system, sans-serif`;

/**
 * Draws one annotation. `base` is the unannotated screenshot — pixelate and
 * blur sample from it so redaction never leaks other annotations.
 */
export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, base: HTMLCanvasElement): void {
  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shape.type) {
    case 'line':
      strokePath(ctx, [shape.from, shape.to]);
      break;
    case 'arrow':
      drawArrow(ctx, shape);
      break;
    case 'pen':
      strokePath(ctx, shape.points);
      break;
    case 'rect':
      ctx.strokeRect(shape.rect.x, shape.rect.y, shape.rect.width, shape.rect.height);
      break;
    case 'ellipse': {
      const { x, y, width, height } = shape.rect;
      ctx.beginPath();
      ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'highlight':
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillRect(shape.rect.x, shape.rect.y, shape.rect.width, shape.rect.height);
      break;
    case 'pixelate':
      drawPixelated(ctx, base, shape.rect, Math.max(6, shape.size * 2));
      break;
    case 'blur':
      drawBlurred(ctx, base, shape.rect, Math.max(6, shape.size * 2));
      break;
    case 'text':
      drawText(ctx, shape);
      break;
    case 'counter':
      drawCounter(ctx, shape);
      break;
  }

  ctx.restore();
}

function strokePath(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  if (points.length === 1) ctx.lineTo(points[0].x + 0.01, points[0].y);
  ctx.stroke();
}

function drawArrow(ctx: CanvasRenderingContext2D, { from, to, size }: LineShape): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const head = Math.min(size * 4 + 8, length * 0.6);
  const wing = Math.PI / 7;

  // Stop the shaft inside the head so the round cap doesn't poke through the tip.
  const shaftEnd = { x: to.x - Math.cos(angle) * head * 0.6, y: to.y - Math.sin(angle) * head * 0.6 };
  strokePath(ctx, [from, shaftEnd]);

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - head * Math.cos(angle - wing), to.y - head * Math.sin(angle - wing));
  ctx.lineTo(to.x - head * Math.cos(angle + wing), to.y - head * Math.sin(angle + wing));
  ctx.closePath();
  ctx.fill();
}

function drawPixelated(ctx: CanvasRenderingContext2D, base: HTMLCanvasElement, r: Rect, block: number): void {
  if (r.width < 1 || r.height < 1) return;
  const tiny = createCanvas(Math.ceil(r.width / block), Math.ceil(r.height / block));
  get2d(tiny).drawImage(base, r.x, r.y, r.width, r.height, 0, 0, tiny.width, tiny.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, r.x, r.y, r.width, r.height);
}

function drawBlurred(ctx: CanvasRenderingContext2D, base: HTMLCanvasElement, r: Rect, radius: number): void {
  if (r.width < 1 || r.height < 1) return;
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.width, r.height);
  ctx.clip();
  ctx.filter = `blur(${radius}px)`;
  // Sample a margin around the area so edges blur toward real content, not transparency.
  const m = radius * 2;
  ctx.drawImage(base, r.x - m, r.y - m, r.width + m * 2, r.height + m * 2, r.x - m, r.y - m, r.width + m * 2, r.height + m * 2);
}

function drawText(ctx: CanvasRenderingContext2D, shape: TextShape): void {
  const px = fontSize(shape.size);
  ctx.font = font(shape.size);
  ctx.textBaseline = 'top';
  ctx.lineWidth = Math.max(2, px / 6);
  ctx.strokeStyle = isLight(shape.color) ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)';
  shape.text.split('\n').forEach((line, i) => {
    const y = shape.at.y + i * px * 1.2;
    ctx.strokeText(line, shape.at.x, y);
    ctx.fillText(line, shape.at.x, y);
  });
}

function drawCounter(ctx: CanvasRenderingContext2D, shape: CounterShape): void {
  const r = counterRadius(shape.size);
  ctx.beginPath();
  ctx.arc(shape.at.x, shape.at.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.fillStyle = isLight(shape.color) ? '#000' : '#fff';
  ctx.font = `700 ${Math.round(r * 1.1)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(shape.n), shape.at.x, shape.at.y + 1);
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 186;
}

export function boundsOf(shape: Shape): Rect {
  switch (shape.type) {
    case 'arrow':
    case 'line':
      return pointsBounds([shape.from, shape.to]);
    case 'pen':
      return pointsBounds(shape.points);
    case 'text': {
      const px = fontSize(shape.size);
      const lines = shape.text.split('\n');
      const longest = Math.max(...lines.map((l) => l.length));
      return { x: shape.at.x, y: shape.at.y, width: longest * px * 0.58, height: lines.length * px * 1.2 };
    }
    case 'counter': {
      const r = counterRadius(shape.size);
      return { x: shape.at.x - r, y: shape.at.y - r, width: r * 2, height: r * 2 };
    }
    default:
      return shape.rect;
  }
}

function pointsBounds(points: Point[]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function hitTest(shape: Shape, p: Point): boolean {
  const tolerance = shape.size / 2 + HIT_TOLERANCE;
  switch (shape.type) {
    case 'arrow':
    case 'line':
      return distanceToSegment(p, shape.from, shape.to) <= tolerance;
    case 'pen':
      return shape.points.some((pt, i) => distanceToSegment(p, pt, shape.points[i + 1] ?? pt) <= tolerance);
    case 'counter':
      return Math.hypot(p.x - shape.at.x, p.y - shape.at.y) <= counterRadius(shape.size) + HIT_TOLERANCE;
    default:
      return containsPoint(boundsOf(shape), p, HIT_TOLERANCE);
  }
}

export function translateShape(shape: Shape, dx: number, dy: number): Shape {
  const move = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  switch (shape.type) {
    case 'arrow':
    case 'line':
      return { ...shape, from: move(shape.from), to: move(shape.to) };
    case 'pen':
      return { ...shape, points: shape.points.map(move) };
    case 'text':
    case 'counter':
      return { ...shape, at: move(shape.at) };
    default:
      return { ...shape, rect: { ...shape.rect, x: shape.rect.x + dx, y: shape.rect.y + dy } };
  }
}

/** True when a just-drawn shape is too small to keep (an accidental click). */
export function isDegenerate(shape: Shape): boolean {
  const b = boundsOf(shape);
  switch (shape.type) {
    case 'text':
      return shape.text.trim() === '';
    case 'counter':
      return false;
    case 'pen':
      return shape.points.length < 2;
    default:
      return b.width < 3 && b.height < 3;
  }
}
