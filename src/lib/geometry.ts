export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Normalized rect spanning two corner points (drag start → drag end). */
export function rectFromPoints(a: Point, b: Point, square = false): Rect {
  let dx = b.x - a.x;
  let dy = b.y - a.y;

  if (square) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side;
  }

  return {
    x: Math.min(a.x, a.x + dx),
    y: Math.min(a.y, a.y + dy),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };
}

/** Intersects `rect` with `bounds`, never returning negative sizes. */
export function clampRect(rect: Rect, bounds: Rect): Rect {
  const x = clamp(rect.x, bounds.x, bounds.x + bounds.width);
  const y = clamp(rect.y, bounds.y, bounds.y + bounds.height);
  const right = clamp(rect.x + rect.width, bounds.x, bounds.x + bounds.width);
  const bottom = clamp(rect.y + rect.height, bounds.y, bounds.y + bounds.height);
  return { x, y, width: right - x, height: bottom - y };
}

export const roundRect = (r: Rect): Rect => ({
  x: Math.round(r.x),
  y: Math.round(r.y),
  width: Math.round(r.width),
  height: Math.round(r.height),
});

export const containsPoint = (r: Rect, p: Point, tolerance = 0): boolean =>
  p.x >= r.x - tolerance &&
  p.x <= r.x + r.width + tolerance &&
  p.y >= r.y - tolerance &&
  p.y <= r.y + r.height + tolerance;

/** Shortest distance from `p` to the segment a→b. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Rect expressed as fractions of a frame, so it survives a resolution change. */
export const toRelative = (r: Rect, w: number, h: number): Rect => ({
  x: r.x / w,
  y: r.y / h,
  width: r.width / w,
  height: r.height / h,
});

export const fromRelative = (r: Rect, w: number, h: number): Rect =>
  roundRect({ x: r.x * w, y: r.y * h, width: r.width * w, height: r.height * h });
