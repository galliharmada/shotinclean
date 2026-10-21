import { describe, expect, it } from 'vitest';
import { clampRect, distanceToSegment, fromRelative, rectFromPoints, toRelative } from '../src/lib/geometry';

describe('rectFromPoints', () => {
  it('normalizes a drag in any direction', () => {
    expect(rectFromPoints({ x: 50, y: 40 }, { x: 10, y: 10 })).toEqual({ x: 10, y: 10, width: 40, height: 30 });
  });

  it('constrains to a square when shift is held, keeping drag direction', () => {
    expect(rectFromPoints({ x: 100, y: 100 }, { x: 60, y: 120 }, true)).toEqual({ x: 60, y: 100, width: 40, height: 40 });
  });
});

describe('clampRect', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  it('intersects with bounds', () => {
    expect(clampRect({ x: -10, y: 90, width: 50, height: 50 }, bounds)).toEqual({ x: 0, y: 90, width: 40, height: 10 });
  });

  it('never yields negative sizes', () => {
    expect(clampRect({ x: 150, y: 150, width: 10, height: 10 }, bounds)).toEqual({ x: 100, y: 100, width: 0, height: 0 });
  });
});

describe('distanceToSegment', () => {
  it('measures perpendicular distance and clamps to endpoints', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    expect(distanceToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });
});

describe('relative rects (Capture Previous Area)', () => {
  it('round-trips across resolutions', () => {
    const rel = toRelative({ x: 100, y: 50, width: 400, height: 300 }, 1000, 500);
    expect(fromRelative(rel, 2000, 1000)).toEqual({ x: 200, y: 100, width: 800, height: 600 });
  });
});
