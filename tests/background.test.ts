import { describe, expect, it } from 'vitest';
import { type BackgroundOptions, DEFAULT_BACKGROUND, computeLayout } from '../src/editor/background';

const opts = (patch: Partial<BackgroundOptions>): BackgroundOptions => ({ ...DEFAULT_BACKGROUND, enabled: true, ...patch });

describe('computeLayout', () => {
  it('is the identity when the background is disabled', () => {
    expect(computeLayout(800, 600, { ...DEFAULT_BACKGROUND, enabled: false })).toEqual({
      width: 800,
      height: 600,
      image: { x: 0, y: 0, width: 800, height: 600 },
    });
  });

  it('pads evenly on all sides', () => {
    const layout = computeLayout(800, 600, opts({ padding: 50, aspect: 'auto' }));
    expect(layout).toMatchObject({ width: 900, height: 700, image: { x: 50, y: 50, width: 800, height: 600 } });
  });

  it('grows the short side to hit the aspect ratio without scaling the image', () => {
    const layout = computeLayout(1000, 200, opts({ padding: 0, aspect: '16:9' }));
    expect(layout.width).toBe(1000);
    expect(layout.height).toBe(563);
    expect(layout.image).toEqual({ x: 0, y: 182, width: 1000, height: 200 });
  });

  it('handles portrait targets', () => {
    const layout = computeLayout(400, 400, opts({ padding: 0, aspect: '9:16' }));
    expect(layout.width).toBe(400);
    expect(layout.height).toBe(711);
  });
});
