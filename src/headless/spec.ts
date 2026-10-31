import { type AspectRatio, type BackgroundFill, type BackgroundOptions, DEFAULT_BACKGROUND, GRADIENTS } from '../editor/background';
import type { Shape } from '../editor/shapes';
import type { Point, Rect } from '../lib/geometry';

/**
 * The JSON an agent writes to describe a render. Coordinates are in "spec
 * pixels"; `scale` maps them to image pixels (the CLI sets it to the
 * capture's deviceScaleFactor, so agents can think in CSS pixels).
 */
export type PointInput = [number, number];
export type RectInput = [number, number, number, number];

export type Direction = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right';

export type AnnotationType = 'arrow' | 'line' | 'rect' | 'ellipse' | 'highlight' | 'pixelate' | 'blur' | 'text' | 'counter';

export interface AnnotationInput {
  type: AnnotationType;
  /** arrow/line start. Optional for arrows: the tail is placed automatically. */
  from?: PointInput;
  /** Arrows without `from`: which way the tail sticks out from `to`. Defaults to toward the image center. */
  direction?: Direction;
  to?: PointInput;
  rect?: RectInput;
  at?: PointInput;
  text?: string;
  /** counter number; omitted counters number themselves 1, 2, 3… */
  n?: number;
  color?: string;
  size?: number;
}

export interface BackgroundInput {
  /** "gradient", "gradient:1".."gradient:6", "#rrggbb" or "transparent". */
  fill?: string;
  padding?: number;
  radius?: number;
  shadow?: number;
  aspect?: AspectRatio;
}

export interface RenderSpec {
  scale?: number;
  crop?: RectInput;
  background?: BackgroundInput | boolean;
  annotations?: AnnotationInput[];
}

export interface NormalizedSpec {
  crop: Rect | null;
  shapes: Shape[];
  background: BackgroundOptions;
}

export class SpecError extends Error {
  override name = 'SpecError';
}

const DEFAULT_COLOR = '#ff3b30';
const DEFAULT_HIGHLIGHT = '#ffcc00';
const DEFAULT_SIZE = 6;
const ARROW_TAIL = 120;
const EDGE_MARGIN = 10;

// Straight up/down/left/right tails are tilted slightly, which reads more naturally.
const DIRECTIONS: Record<Direction, [number, number]> = {
  up: [0.35, -1],
  down: [0.35, 1],
  left: [-1, 0.35],
  right: [1, 0.35],
  'up-left': [-1, -1],
  'up-right': [1, -1],
  'down-left': [-1, 1],
  'down-right': [1, 1],
};
const ASPECTS: readonly AspectRatio[] = ['auto', '1:1', '4:3', '16:9', '9:16'];
const BOX_TYPES = ['rect', 'ellipse', 'highlight', 'pixelate', 'blur'] as const;

type BoxType = (typeof BOX_TYPES)[number];

const isBoxType = (type: string): type is BoxType => (BOX_TYPES as readonly string[]).includes(type);

function point(value: unknown, where: string, scale: number): Point {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) {
    throw new SpecError(`${where} must be [x, y], got ${JSON.stringify(value)}`);
  }
  return { x: value[0] * scale, y: value[1] * scale };
}

function rect(value: unknown, where: string, scale: number): Rect {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite)) {
    throw new SpecError(`${where} must be [x, y, width, height], got ${JSON.stringify(value)}`);
  }
  const [x, y, width, height] = value.map((v: number) => v * scale);
  if (width <= 0 || height <= 0) throw new SpecError(`${where} needs a positive width and height`);
  return { x, y, width, height };
}

export function parseFill(fill: string): BackgroundFill {
  if (fill === 'transparent') return { kind: 'transparent' };
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(fill)) return { kind: 'solid', color: fill };

  const match = /^gradient(?::(\d+))?$/.exec(fill);
  if (match) {
    const index = Number(match[1] ?? 2) - 1;
    const gradient = GRADIENTS[index];
    if (!gradient) throw new SpecError(`gradient index must be 1-${GRADIENTS.length}, got ${match[1]}`);
    return gradient;
  }

  throw new SpecError(`background.fill must be "gradient[:n]", "#hex" or "transparent", got "${fill}"`);
}

function background(input: RenderSpec['background'], scale: number): BackgroundOptions {
  if (!input) return { ...DEFAULT_BACKGROUND, enabled: false };
  const opts = input === true ? {} : input;
  if (opts.aspect && !ASPECTS.includes(opts.aspect)) {
    throw new SpecError(`background.aspect must be one of ${ASPECTS.join(', ')}`);
  }
  return {
    enabled: true,
    fill: opts.fill ? parseFill(opts.fill) : DEFAULT_BACKGROUND.fill,
    padding: (opts.padding ?? DEFAULT_BACKGROUND.padding) * scale,
    radius: (opts.radius ?? DEFAULT_BACKGROUND.radius) * scale,
    shadow: (opts.shadow ?? DEFAULT_BACKGROUND.shadow) * scale,
    aspect: opts.aspect ?? 'auto',
  };
}

/** How far (≤ `max`) you can travel from `p` along unit vector `d` and stay inside the frame. */
function room(p: Point, d: Point, max: number, w: number, h: number): number {
  const limit = (pos: number, dir: number, size: number) =>
    dir > 0 ? (size - EDGE_MARGIN - pos) / dir : dir < 0 ? (EDGE_MARGIN - pos) / dir : Infinity;
  return Math.max(0, Math.min(max, limit(p.x, d.x, w), limit(p.y, d.y, h)));
}

/**
 * Tail for an arrow without `from`: along `direction` (or toward the image
 * center), shortened so it stays inside the frame. If that leaves too
 * little room, the horizontal component is mirrored.
 */
function arrowTail(to: Point, direction: Direction | undefined, w: number, h: number, scale: number): Point {
  const [rawX, rawY] = direction ? DIRECTIONS[direction] : [w / 2 - to.x, h / 2 - to.y];
  const length = Math.hypot(rawX, rawY) || 1;
  const max = ARROW_TAIL * scale;

  const preferred = { x: rawX / length, y: rawY / length };
  const mirrored = { x: -preferred.x, y: preferred.y };
  const preferredRoom = room(to, preferred, max, w, h);
  const mirroredRoom = room(to, mirrored, max, w, h);
  const usePreferred = preferredRoom >= max * 0.6 || preferredRoom >= mirroredRoom;
  const [d, t] = usePreferred ? [preferred, preferredRoom] : [mirrored, mirroredRoom];

  return { x: to.x + d.x * t, y: to.y + d.y * t };
}

/**
 * Validates an agent-written spec and converts it into editor shapes in
 * image pixels, relative to the crop (if any). Throws `SpecError` with a
 * message that says exactly which field is wrong.
 */
export function normalizeSpec(spec: RenderSpec, width: number, height: number): NormalizedSpec {
  const scale = spec.scale ?? 1;
  if (!(scale > 0)) throw new SpecError('scale must be a positive number');

  const crop = spec.crop ? rect(spec.crop, 'crop', scale) : null;
  const offset = crop ? { x: crop.x, y: crop.y } : { x: 0, y: 0 };
  const shift = (p: Point): Point => ({ x: p.x - offset.x, y: p.y - offset.y });
  const frame = { width: crop?.width ?? width, height: crop?.height ?? height };

  let counter = 0;
  const shapes = (spec.annotations ?? []).map((a, i): Shape => {
    const where = `annotations[${i}] (${a?.type})`;
    const base = {
      id: `a${i}`,
      color: a.color ?? (a.type === 'highlight' ? DEFAULT_HIGHLIGHT : DEFAULT_COLOR),
      size: (a.size ?? DEFAULT_SIZE) * scale,
    };

    if (a.type === 'arrow' || a.type === 'line') {
      const to = shift(point(a.to, `${where}.to`, scale));
      if (a.direction !== undefined && !(a.direction in DIRECTIONS)) {
        throw new SpecError(`${where}.direction must be one of ${Object.keys(DIRECTIONS).join(', ')}`);
      }
      const from =
        a.from === undefined && a.type === 'arrow'
          ? arrowTail(to, a.direction, frame.width, frame.height, scale)
          : shift(point(a.from, `${where}.from`, scale));
      return { ...base, type: a.type, from, to };
    }

    if (isBoxType(a.type)) {
      const r = rect(a.rect, `${where}.rect`, scale);
      return { ...base, type: a.type, rect: { ...r, ...shift(r) } };
    }

    if (a.type === 'text') {
      if (typeof a.text !== 'string' || a.text === '') throw new SpecError(`${where}.text must be a non-empty string`);
      return { ...base, type: 'text', at: shift(point(a.at, `${where}.at`, scale)), text: a.text };
    }

    if (a.type === 'counter') {
      counter = a.n ?? counter + 1;
      return { ...base, type: 'counter', at: shift(point(a.at, `${where}.at`, scale)), n: counter };
    }

    throw new SpecError(`${where}: unknown type. Use one of arrow, line, ${BOX_TYPES.join(', ')}, text, counter`);
  });

  return { crop, shapes, background: background(spec.background, scale) };
}
