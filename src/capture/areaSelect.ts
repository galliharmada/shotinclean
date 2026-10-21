import { createCanvas, get2d, h } from '../lib/dom';
import { type Point, type Rect, clampRect, rectFromPoints, roundRect } from '../lib/geometry';

const MAGNIFIER_SIZE = 132;
const MAGNIFIER_ZOOM = 8;
const MIN_SELECTION = 4;

/**
 * Freeze-frame area selection: the captured frame is shown full-viewport,
 * the user drags a rectangle (Shift = square), sees live dimensions and a
 * pixel loupe, and confirms on release. Esc cancels.
 *
 * Resolves with the selected rect in source-pixel coordinates.
 */
export function selectArea(frame: HTMLCanvasElement, initial?: Rect): Promise<Rect | null> {
  return new Promise((resolve) => {
    const view = h('canvas', { class: 'area-canvas' });
    const loupe = h('canvas', { class: 'area-loupe', width: MAGNIFIER_SIZE, height: MAGNIFIER_SIZE });
    const label = h('div', { class: 'area-label' });
    const hint = h('div', { class: 'area-hint' }, 'Drag to select · Shift for square · Enter to capture all · Esc to cancel');
    const overlay = h('div', { class: 'area-overlay', tabindex: -1 }, view, loupe, label, hint);
    document.body.append(overlay);

    const ctx = get2d(view);
    const loupeCtx = get2d(loupe);
    const bounds: Rect = { x: 0, y: 0, width: frame.width, height: frame.height };

    let fit = { scale: 1, offsetX: 0, offsetY: 0 };
    let anchor: Point | null = null;
    let cursor: Point = { x: frame.width / 2, y: frame.height / 2 };
    let selection: Rect | null = initial ?? null;

    function layout() {
      const dpr = window.devicePixelRatio || 1;
      view.width = innerWidth * dpr;
      view.height = innerHeight * dpr;
      const scale = Math.min(view.width / frame.width, view.height / frame.height);
      fit = {
        scale,
        offsetX: (view.width - frame.width * scale) / 2,
        offsetY: (view.height - frame.height * scale) / 2,
      };
      draw();
    }

    const toSource = (e: PointerEvent): Point => {
      const dpr = window.devicePixelRatio || 1;
      return {
        x: Math.min(Math.max((e.clientX * dpr - fit.offsetX) / fit.scale, 0), frame.width),
        y: Math.min(Math.max((e.clientY * dpr - fit.offsetY) / fit.scale, 0), frame.height),
      };
    };

    function draw() {
      const { scale, offsetX, offsetY } = fit;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.drawImage(frame, offsetX, offsetY, frame.width * scale, frame.height * scale);

      // Dim everything, then punch the selection back out at full brightness.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, view.width, view.height);

      if (selection && selection.width > 0 && selection.height > 0) {
        const sx = offsetX + selection.x * scale;
        const sy = offsetY + selection.y * scale;
        const sw = selection.width * scale;
        const sh = selection.height * scale;
        ctx.drawImage(frame, selection.x, selection.y, selection.width, selection.height, sx, sy, sw, sh);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw, sh);
        ctx.setLineDash([]);

        const r = roundRect(selection);
        label.textContent = `${r.width} × ${r.height}`;
        // Sit just above the selection's top-left corner, clear of the loupe.
        const dpr = window.devicePixelRatio || 1;
        label.style.transform = `translate(${sx / dpr}px, ${Math.max(4, sy / dpr - 28)}px)`;
        label.hidden = false;
      } else {
        label.hidden = true;
      }

      drawCrosshair();
      drawLoupe();
    }

    function drawCrosshair() {
      const { scale, offsetX, offsetY } = fit;
      const cx = offsetX + cursor.x * scale;
      const cy = offsetY + cursor.y * scale;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, 0);
      ctx.lineTo(cx + 0.5, view.height);
      ctx.moveTo(0, cy + 0.5);
      ctx.lineTo(view.width, cy + 0.5);
      ctx.stroke();
    }

    function drawLoupe() {
      const span = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;
      loupeCtx.imageSmoothingEnabled = false;
      loupeCtx.fillStyle = '#000';
      loupeCtx.fillRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
      loupeCtx.drawImage(
        frame,
        Math.floor(cursor.x - span / 2),
        Math.floor(cursor.y - span / 2),
        span,
        span,
        0,
        0,
        MAGNIFIER_SIZE,
        MAGNIFIER_SIZE,
      );
      const mid = MAGNIFIER_SIZE / 2;
      loupeCtx.strokeStyle = '#ff3b30';
      loupeCtx.strokeRect(mid - MAGNIFIER_ZOOM / 2, mid - MAGNIFIER_ZOOM / 2, MAGNIFIER_ZOOM, MAGNIFIER_ZOOM);
      loupeCtx.fillStyle = 'rgba(0,0,0,0.6)';
      loupeCtx.fillRect(0, MAGNIFIER_SIZE - 26, MAGNIFIER_SIZE, 26);
      loupeCtx.fillStyle = '#fff';
      loupeCtx.font = '11px ui-monospace, monospace';
      loupeCtx.textAlign = 'center';
      loupeCtx.fillText(`${Math.round(cursor.x)}, ${Math.round(cursor.y)}`, mid, MAGNIFIER_SIZE - 10);
    }

    function positionLoupe(e: PointerEvent) {
      const flipX = e.clientX + MAGNIFIER_SIZE + 24 > innerWidth;
      const flipY = e.clientY + MAGNIFIER_SIZE + 24 > innerHeight;
      const x = flipX ? e.clientX - MAGNIFIER_SIZE - 16 : e.clientX + 16;
      const y = flipY ? e.clientY - MAGNIFIER_SIZE - 16 : e.clientY + 16;
      loupe.style.transform = `translate(${x}px, ${y}px)`;
    }

    function finish(result: Rect | null) {
      removeEventListener('resize', layout);
      overlay.remove();
      resolve(result && result.width >= MIN_SELECTION && result.height >= MIN_SELECTION ? roundRect(result) : null);
    }

    overlay.addEventListener('pointerdown', (e) => {
      overlay.setPointerCapture(e.pointerId);
      anchor = toSource(e);
      selection = null;
      draw();
    });

    overlay.addEventListener('pointermove', (e) => {
      cursor = toSource(e);
      positionLoupe(e);
      if (anchor) selection = clampRect(rectFromPoints(anchor, cursor, e.shiftKey), bounds);
      draw();
    });

    overlay.addEventListener('pointerup', () => {
      anchor = null;
      finish(selection);
    });

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') finish(null);
      if (e.key === 'Enter') finish(selection ?? bounds);
    });

    addEventListener('resize', layout);
    layout();
    overlay.focus();
  });
}

export function cropCanvas(source: HTMLCanvasElement, rect: Rect): HTMLCanvasElement {
  const out = createCanvas(rect.width, rect.height);
  get2d(out).drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return out;
}
