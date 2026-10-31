import { describe, expect, it } from 'vitest';
import { GRADIENTS } from '../src/editor/background';
import { SpecError, normalizeSpec, parseFill } from '../src/headless/spec';

describe('normalizeSpec', () => {
  it('scales CSS-pixel coordinates and sizes to image pixels', () => {
    const { shapes } = normalizeSpec({ scale: 2, annotations: [{ type: 'rect', rect: [10, 20, 30, 40], size: 3 }] }, 800, 600);
    expect(shapes[0]).toMatchObject({ type: 'rect', rect: { x: 20, y: 40, width: 60, height: 80 }, size: 6 });
  });

  it('makes annotations relative to the crop', () => {
    const { crop, shapes } = normalizeSpec(
      { crop: [100, 50, 200, 100], annotations: [{ type: 'counter', at: [150, 70] }] },
      800,
      600,
    );
    expect(crop).toEqual({ x: 100, y: 50, width: 200, height: 100 });
    expect(shapes[0]).toMatchObject({ at: { x: 50, y: 20 } });
  });

  it('numbers counters automatically, honoring explicit values', () => {
    const { shapes } = normalizeSpec(
      {
        annotations: [
          { type: 'counter', at: [1, 1] },
          { type: 'counter', at: [2, 2], n: 5 },
          { type: 'counter', at: [3, 3] },
        ],
      },
      100,
      100,
    );
    expect(shapes.map((s) => (s.type === 'counter' ? s.n : null))).toEqual([1, 5, 6]);
  });

  it('places an arrow tail along `direction` and keeps it inside the frame', () => {
    const { shapes } = normalizeSpec({ annotations: [{ type: 'arrow', to: [50, 180], direction: 'down' }] }, 400, 200);
    const arrow = shapes[0];
    if (arrow.type !== 'arrow') throw new Error('expected arrow');
    expect(arrow.from.y).toBeGreaterThan(180);
    expect(arrow.from.y).toBeLessThanOrEqual(190);
  });

  it('mirrors the tail horizontally when the preferred side has no room', () => {
    const { shapes } = normalizeSpec({ annotations: [{ type: 'arrow', to: [395, 100], direction: 'right' }] }, 400, 200);
    const arrow = shapes[0];
    if (arrow.type !== 'arrow') throw new Error('expected arrow');
    expect(arrow.from.x).toBeLessThan(395);
  });

  it('defaults arrows to point from the image center side', () => {
    const { shapes } = normalizeSpec({ annotations: [{ type: 'arrow', to: [10, 10] }] }, 400, 400);
    const arrow = shapes[0];
    if (arrow.type !== 'arrow') throw new Error('expected arrow');
    expect(arrow.from.x).toBeGreaterThan(10);
    expect(arrow.from.y).toBeGreaterThan(10);
  });

  it('enables the background with defaults for `true` and scales its metrics', () => {
    const { background } = normalizeSpec({ scale: 2, background: { fill: 'gradient:1', padding: 40 } }, 10, 10);
    expect(background).toMatchObject({ enabled: true, fill: GRADIENTS[0], padding: 80 });
    expect(normalizeSpec({ background: true }, 10, 10).background.enabled).toBe(true);
    expect(normalizeSpec({}, 10, 10).background.enabled).toBe(false);
  });

  it.each([
    [{ annotations: [{ type: 'arrow', to: [1, 2, 3] }] }, /annotations\[0\] \(arrow\)\.to must be \[x, y\]/],
    [{ annotations: [{ type: 'rect', rect: [0, 0, 0, 10] }] }, /positive width and height/],
    [{ annotations: [{ type: 'text', at: [0, 0] }] }, /text must be a non-empty string/],
    [{ annotations: [{ type: 'star' }] }, /unknown type/],
    [{ annotations: [{ type: 'arrow', to: [1, 1], direction: 'sideways' }] }, /direction must be one of/],
    [{ background: { aspect: '2:1' } }, /aspect must be one of/],
  ])('rejects invalid input with a precise message (%#)', (spec, message) => {
    expect(() => normalizeSpec(spec as never, 100, 100)).toThrow(SpecError);
    expect(() => normalizeSpec(spec as never, 100, 100)).toThrow(message);
  });
});

describe('parseFill', () => {
  it('understands every fill form', () => {
    expect(parseFill('transparent')).toEqual({ kind: 'transparent' });
    expect(parseFill('#0af')).toEqual({ kind: 'solid', color: '#0af' });
    expect(parseFill('gradient')).toBe(GRADIENTS[1]);
    expect(parseFill('gradient:6')).toBe(GRADIENTS[5]);
    expect(() => parseFill('gradient:9')).toThrow(/1-6/);
    expect(() => parseFill('red')).toThrow(SpecError);
  });
});
