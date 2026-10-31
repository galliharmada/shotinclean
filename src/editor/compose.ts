import { type BackgroundLayout, type BackgroundOptions, clipImage, paintBackground } from './background';
import { type Shape, drawShape } from './shapes';

/**
 * Draws backdrop + screenshot + annotations. Shared by the interactive editor
 * and the headless engine, so the app and the CLI render identical pixels.
 */
export function composeImage(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  shapes: readonly Shape[],
  bg: BackgroundOptions,
  layout: BackgroundLayout,
): void {
  ctx.clearRect(0, 0, layout.width, layout.height);
  paintBackground(ctx, layout, bg);

  ctx.save();
  clipImage(ctx, layout, bg);
  ctx.translate(layout.image.x, layout.image.y);
  ctx.drawImage(base, 0, 0);
  for (const shape of shapes) drawShape(ctx, shape, base);
  ctx.restore();
}
