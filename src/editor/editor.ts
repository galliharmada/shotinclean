import { cropCanvas } from '../capture/areaSelect';
import { canvasToBlob, copyImage, createCanvas, downloadBlob, get2d, h, timestampName } from '../lib/dom';
import { type Point, type Rect, clampRect, rectFromPoints, roundRect } from '../lib/geometry';
import { toast } from '../ui/toast';
import {
  type BackgroundOptions,
  type BackgroundLayout,
  DEFAULT_BACKGROUND,
  GRADIENTS,
  clipImage,
  computeLayout,
  paintBackground,
} from './background';
import {
  type CounterShape,
  type Shape,
  type Tool,
  boundsOf,
  drawShape,
  fontSize,
  hitTest,
  isDegenerate,
  newId,
  translateShape,
} from './shapes';

interface Doc {
  /** Immutable: crop replaces it with a new canvas, so snapshots can share it. */
  base: HTMLCanvasElement;
  shapes: Shape[];
}

const TOOLS: ReadonlyArray<{ tool: Tool; label: string; key: string; icon: string }> = [
  { tool: 'select', label: 'Select / move', key: 'v', icon: '⬚' },
  { tool: 'arrow', label: 'Arrow', key: 'a', icon: '↗' },
  { tool: 'line', label: 'Line', key: 'l', icon: '╱' },
  { tool: 'rect', label: 'Rectangle', key: 'r', icon: '▭' },
  { tool: 'ellipse', label: 'Ellipse', key: 'o', icon: '◯' },
  { tool: 'pen', label: 'Pen', key: 'd', icon: '✎' },
  { tool: 'text', label: 'Text', key: 't', icon: 'T' },
  { tool: 'highlight', label: 'Highlighter', key: 'h', icon: '▮' },
  { tool: 'counter', label: 'Counter', key: 'n', icon: '①' },
  { tool: 'pixelate', label: 'Pixelate', key: 'p', icon: '▦' },
  { tool: 'blur', label: 'Blur', key: 'b', icon: '◌' },
  { tool: 'crop', label: 'Crop', key: 'c', icon: '⌗' },
];

const COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0a84ff', '#af52de', '#ffffff', '#000000'];

const STORAGE_KEY = 'shotinclean.editor';

interface Persisted {
  tool: Tool;
  color: string;
  size: number;
  background: BackgroundOptions;
}

function loadPrefs(): Persisted {
  const defaults: Persisted = { tool: 'arrow', color: COLORS[0], size: 6, background: DEFAULT_BACKGROUND };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

function savePrefs(prefs: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode / storage disabled: preferences just won't persist.
  }
}

/** Opens the annotation editor. Resolves with the flattened result, or null on cancel. */
export function openEditor(source: HTMLCanvasElement): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => new Editor(source, resolve).mount());
}

class Editor {
  private doc: Doc;
  private undoStack: Doc[] = [];
  private redoStack: Doc[] = [];

  private tool: Tool;
  private color: string;
  private size: number;
  private bg: BackgroundOptions;

  private draft: Shape | null = null;
  private cropRect: Rect | null = null;
  private selectedId: string | null = null;
  private drag: { start: Point; last: Point; mode: 'draw' | 'move' | 'crop' } | null = null;
  private layout!: BackgroundLayout;

  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly stage: HTMLDivElement;
  private readonly toolButtons = new Map<Tool, HTMLButtonElement>();
  private readonly bgPanel: HTMLElement;
  private readonly cropBar: HTMLElement;
  private textInput: HTMLTextAreaElement | null = null;

  constructor(
    source: HTMLCanvasElement,
    private readonly resolve: (result: HTMLCanvasElement | null) => void,
  ) {
    const prefs = loadPrefs();
    this.tool = prefs.tool;
    this.color = prefs.color;
    this.size = prefs.size;
    this.bg = { ...prefs.background };
    this.doc = { base: source, shapes: [] };

    this.canvas = h('canvas', { class: 'editor-canvas' });
    this.ctx = get2d(this.canvas);
    this.cropBar = h(
      'div',
      { class: 'editor-cropbar', hidden: true },
      h('button', { class: 'btn', onclick: () => this.cancelCrop() }, 'Cancel'),
      h('button', { class: 'btn btn-primary', onclick: () => this.applyCrop() }, 'Apply crop ⏎'),
    );
    this.stage = h('div', { class: 'editor-stage' }, this.canvas, this.cropBar);
    this.bgPanel = this.buildBackgroundPanel();
    this.root = h(
      'div',
      { class: 'editor', role: 'dialog', 'aria-label': 'Annotate', tabindex: -1 },
      this.buildToolbar(),
      h('div', { class: 'editor-body' }, this.stage, this.bgPanel),
    );
  }

  mount(): void {
    document.body.append(this.root);
    this.bindPointer();
    this.root.addEventListener('keydown', (e) => this.onKey(e));
    this.selectTool(this.tool);
    this.render();
    this.root.focus();
  }

  // ── UI construction ────────────────────────────────────────────────

  private buildToolbar(): HTMLElement {
    const tools = TOOLS.map(({ tool, label, key, icon }) => {
      const btn = h(
        'button',
        { class: 'tool', title: `${label} (${key.toUpperCase()})`, 'aria-label': label, onclick: () => this.selectTool(tool) },
        icon,
      );
      this.toolButtons.set(tool, btn);
      return btn;
    });

    const swatches = COLORS.map((color) =>
      h('button', {
        class: 'swatch',
        style: `--c:${color}`,
        title: color,
        'aria-label': `Color ${color}`,
        'data-color': color,
        onclick: () => this.setColor(color),
      }),
    );
    const custom = h('input', {
      type: 'color',
      class: 'swatch-custom',
      value: this.color,
      title: 'Custom color',
      oninput: (e: Event) => this.setColor((e.target as HTMLInputElement).value),
    });
    const size = h('input', {
      type: 'range',
      min: 2,
      max: 20,
      value: this.size,
      title: 'Stroke size',
      oninput: (e: Event) => {
        this.size = Number((e.target as HTMLInputElement).value);
        this.updateSelected((s) => ({ ...s, size: this.size }));
        this.persist();
      },
    });

    return h(
      'header',
      { class: 'editor-toolbar' },
      h('div', { class: 'tool-group' }, ...tools),
      h('div', { class: 'tool-group' }, ...swatches, custom, size),
      h(
        'div',
        { class: 'tool-group' },
        h('button', { class: 'tool', title: 'Undo (⌘Z)', onclick: () => this.undo() }, '↶'),
        h('button', { class: 'tool', title: 'Redo (⇧⌘Z)', onclick: () => this.redo() }, '↷'),
        h('button', { class: 'btn', title: 'Background tool', onclick: () => this.toggleBackgroundPanel() }, 'Background'),
      ),
      h(
        'div',
        { class: 'tool-group tool-group-end' },
        h('button', { class: 'btn', onclick: () => this.close(null) }, 'Cancel'),
        h('button', { class: 'btn', title: 'Copy (⌘C)', onclick: () => void this.copy() }, 'Copy'),
        h('button', { class: 'btn', title: 'Save (⌘S)', onclick: () => void this.save() }, 'Save'),
        h('button', { class: 'btn btn-primary', onclick: () => this.close(this.flatten()) }, 'Done'),
      ),
    );
  }

  private buildBackgroundPanel(): HTMLElement {
    const field = (label: string, input: HTMLElement) => h('label', { class: 'field' }, h('span', {}, label), input);
    const range = (key: 'padding' | 'radius' | 'shadow', max: number) =>
      h('input', {
        type: 'range',
        min: 0,
        max,
        value: this.bg[key],
        oninput: (e: Event) => this.setBackground({ [key]: Number((e.target as HTMLInputElement).value) }),
      });

    const gradients = GRADIENTS.map((fill) =>
      h('button', {
        class: 'bg-swatch',
        style: `background: linear-gradient(${fill.angle}deg, ${fill.from}, ${fill.to})`,
        'aria-label': 'Gradient background',
        onclick: () => this.setBackground({ fill, enabled: true }),
      }),
    );

    const aspect = h(
      'select',
      { onchange: (e: Event) => this.setBackground({ aspect: (e.target as HTMLSelectElement).value as BackgroundOptions['aspect'] }) },
      ...(['auto', '16:9', '4:3', '1:1', '9:16'] as const).map((a) =>
        h('option', { value: a, selected: this.bg.aspect === a }, a === 'auto' ? 'Auto' : a),
      ),
    );

    return h(
      'aside',
      { class: 'bg-panel', hidden: !this.bg.enabled },
      h(
        'label',
        { class: 'field field-inline' },
        h('input', {
          type: 'checkbox',
          checked: this.bg.enabled,
          onchange: (e: Event) => this.setBackground({ enabled: (e.target as HTMLInputElement).checked }),
        }),
        h('span', {}, 'Background'),
      ),
      h('div', { class: 'bg-swatches' }, ...gradients),
      h(
        'div',
        { class: 'bg-swatches' },
        h('input', {
          type: 'color',
          title: 'Solid color',
          oninput: (e: Event) =>
            this.setBackground({ fill: { kind: 'solid', color: (e.target as HTMLInputElement).value }, enabled: true }),
        }),
        h(
          'button',
          { class: 'btn btn-small', onclick: () => this.setBackground({ fill: { kind: 'transparent' }, enabled: true }) },
          'Transparent',
        ),
      ),
      field('Padding', range('padding', 240)),
      field('Corner radius', range('radius', 48)),
      field('Shadow', range('shadow', 80)),
      field('Aspect ratio', aspect),
    );
  }

  // ── State changes ──────────────────────────────────────────────────

  private selectTool(tool: Tool): void {
    this.commitText();
    if (this.tool === 'crop' && tool !== 'crop') this.cancelCrop();
    this.tool = tool;
    this.selectedId = tool === 'select' ? this.selectedId : null;
    this.toolButtons.forEach((btn, t) => btn.classList.toggle('active', t === tool));
    this.canvas.dataset.tool = tool;
    this.persist();
    this.render();
  }

  private setColor(color: string): void {
    this.color = color;
    this.root.querySelectorAll<HTMLElement>('.swatch').forEach((el) => el.classList.toggle('active', el.dataset.color === color));
    this.updateSelected((s) => ({ ...s, color }));
    this.persist();
  }

  private setBackground(patch: Partial<BackgroundOptions>): void {
    this.bg = { ...this.bg, ...patch };
    const toggle = this.bgPanel.querySelector<HTMLInputElement>('input[type=checkbox]');
    if (toggle) toggle.checked = this.bg.enabled;
    this.persist();
    this.render();
  }

  private toggleBackgroundPanel(): void {
    this.bgPanel.hidden = !this.bgPanel.hidden;
    if (!this.bgPanel.hidden && !this.bg.enabled) this.setBackground({ enabled: true });
  }

  private persist(): void {
    savePrefs({ tool: this.tool, color: this.color, size: this.size, background: this.bg });
  }

  /** Snapshot before a mutation so it can be undone. */
  private checkpoint(): void {
    this.undoStack.push({ base: this.doc.base, shapes: structuredClone(this.doc.shapes) });
    this.redoStack = [];
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.doc);
    this.doc = prev;
    this.selectedId = null;
    this.render();
  }

  private redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.doc);
    this.doc = next;
    this.render();
  }

  private updateSelected(fn: (shape: Shape) => Shape): void {
    if (!this.selectedId) return;
    this.checkpoint();
    this.doc.shapes = this.doc.shapes.map((s) => (s.id === this.selectedId ? fn(s) : s));
    this.render();
  }

  private deleteSelected(): void {
    if (!this.selectedId) return;
    this.checkpoint();
    this.doc.shapes = this.doc.shapes.filter((s) => s.id !== this.selectedId);
    this.selectedId = null;
    this.render();
  }

  private applyCrop(): void {
    const rect = this.cropRect && roundRect(this.cropRect);
    if (!rect || rect.width < 2 || rect.height < 2) return this.cancelCrop();
    this.checkpoint();
    this.doc = {
      base: cropCanvas(this.doc.base, rect),
      shapes: this.doc.shapes.map((s) => translateShape(s, -rect.x, -rect.y)),
    };
    this.cancelCrop();
    this.selectTool('arrow');
  }

  private cancelCrop(): void {
    this.cropRect = null;
    this.cropBar.hidden = true;
    this.render();
  }

  // ── Pointer handling ───────────────────────────────────────────────

  /** Client coordinates → screenshot pixel coordinates (ignores background padding). */
  private toImage(e: PointerEvent | MouseEvent): Point {
    const box = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) * this.canvas.width) / box.width - this.layout.image.x,
      y: ((e.clientY - box.top) * this.canvas.height) / box.height - this.layout.image.y,
    };
  }

  private bindPointer(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.commitText();
      const p = this.toImage(e);
      this.canvas.setPointerCapture(e.pointerId);

      if (this.tool === 'select') {
        const hit = [...this.doc.shapes].reverse().find((s) => hitTest(s, p));
        this.selectedId = hit?.id ?? null;
        if (hit) {
          this.checkpoint();
          this.drag = { start: p, last: p, mode: 'move' };
        }
        return this.render();
      }

      if (this.tool === 'text') return this.beginText(p, e);

      if (this.tool === 'counter') {
        this.checkpoint();
        const n = Math.max(0, ...this.doc.shapes.filter((s): s is CounterShape => s.type === 'counter').map((s) => s.n)) + 1;
        this.doc.shapes.push({ id: newId(), type: 'counter', color: this.color, size: this.size, at: p, n });
        return this.render();
      }

      this.drag = { start: p, last: p, mode: this.tool === 'crop' ? 'crop' : 'draw' };
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const p = this.toImage(e);
      const { start, last, mode } = this.drag;

      if (mode === 'move') {
        const dx = p.x - last.x;
        const dy = p.y - last.y;
        this.doc.shapes = this.doc.shapes.map((s) => (s.id === this.selectedId ? translateShape(s, dx, dy) : s));
      } else if (mode === 'crop') {
        this.cropRect = clampRect(rectFromPoints(start, p, e.shiftKey), {
          x: 0,
          y: 0,
          width: this.doc.base.width,
          height: this.doc.base.height,
        });
      } else {
        this.draft = this.buildDraft(start, p, e.shiftKey);
      }

      this.drag.last = p;
      this.render();
    });

    const end = () => {
      if (!this.drag) return;
      const { mode } = this.drag;
      this.drag = null;

      if (mode === 'crop' && this.cropRect) this.cropBar.hidden = false;

      if (mode === 'draw' && this.draft) {
        if (!isDegenerate(this.draft)) {
          this.checkpoint();
          this.doc.shapes.push(this.draft);
        }
        this.draft = null;
      }
      this.render();
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);

    this.canvas.addEventListener('dblclick', (e) => {
      // Double-click a text annotation to edit it.
      const p = this.toImage(e);
      const hit = [...this.doc.shapes].reverse().find((s) => s.type === 'text' && hitTest(s, p));
      if (hit?.type !== 'text') return;
      this.checkpoint();
      this.doc.shapes = this.doc.shapes.filter((s) => s.id !== hit.id);
      this.color = hit.color;
      this.size = hit.size;
      this.render();
      this.beginText(hit.at, e, hit.text);
    });

    new ResizeObserver(() => this.render()).observe(this.stage);
  }

  private buildDraft(start: Point, p: Point, shift: boolean): Shape {
    const common = { id: newId(), color: this.color, size: this.size };
    switch (this.tool) {
      case 'arrow':
      case 'line': {
        // Shift snaps to 45° increments.
        const to = shift ? snapAngle(start, p) : p;
        return { ...common, type: this.tool, from: start, to };
      }
      case 'pen': {
        const points = this.draft?.type === 'pen' ? [...this.draft.points, p] : [start, p];
        return { ...common, id: this.draft?.id ?? common.id, type: 'pen', points };
      }
      default:
        return {
          ...common,
          type: this.tool as 'rect' | 'ellipse' | 'highlight' | 'pixelate' | 'blur',
          rect: rectFromPoints(start, p, shift),
        };
    }
  }

  // ── Text ───────────────────────────────────────────────────────────

  private beginText(at: Point, e: MouseEvent, initial = ''): void {
    const box = this.canvas.getBoundingClientRect();
    const stageBox = this.stage.getBoundingClientRect();
    const cssScale = box.width / this.canvas.width;
    const input = h('textarea', { class: 'editor-text', rows: 1, spellcheck: false });
    input.value = initial;
    input.style.left = `${box.left - stageBox.left + (at.x + this.layout.image.x) * cssScale}px`;
    input.style.top = `${box.top - stageBox.top + (at.y + this.layout.image.y) * cssScale}px`;
    input.style.font = `600 ${fontSize(this.size) * cssScale}px ui-sans-serif, system-ui, sans-serif`;
    input.style.color = this.color;
    input.dataset.x = String(at.x);
    input.dataset.y = String(at.y);
    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Escape' || (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey))) this.commitText();
    });
    input.addEventListener('blur', () => this.commitText());
    this.stage.append(input);
    this.textInput = input;
    // Cancelling the pointerdown suppresses the mousedown that would steal focus back,
    // so focusing synchronously guarantees no keystroke reaches the tool shortcuts.
    e.preventDefault();
    input.focus();
  }

  private commitText(): void {
    const input = this.textInput;
    if (!input) return;
    this.textInput = null;
    input.remove();
    const text = input.value.replace(/\s+$/, '');
    if (!text) return;
    this.checkpoint();
    this.doc.shapes.push({
      id: newId(),
      type: 'text',
      color: this.color,
      size: this.size,
      at: { x: Number(input.dataset.x), y: Number(input.dataset.y) },
      text,
    });
    this.render();
    this.root.focus();
  }

  // ── Keyboard ───────────────────────────────────────────────────────

  private onKey(e: KeyboardEvent): void {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    if (mod && key === 'z') return void (e.preventDefault(), e.shiftKey ? this.redo() : this.undo());
    if (mod && key === 'y') return void (e.preventDefault(), this.redo());
    if (mod && key === 'c') return void (e.preventDefault(), this.copy());
    if (mod && key === 's') return void (e.preventDefault(), this.save());
    if (mod) return;

    if (key === 'enter' && this.cropRect) return this.applyCrop();
    if (key === 'escape') return this.cropRect ? this.cancelCrop() : this.close(null);
    if (key === 'delete' || key === 'backspace') return this.deleteSelected();

    const match = TOOLS.find((t) => t.key === key);
    if (match) this.selectTool(match.tool);
  }

  // ── Rendering & output ─────────────────────────────────────────────

  /** Draws the document (and optionally editing chrome) into `ctx`. */
  private paint(ctx: CanvasRenderingContext2D, withChrome: boolean): void {
    const { base, shapes } = this.doc;
    const layout = this.layout;

    ctx.clearRect(0, 0, layout.width, layout.height);
    paintBackground(ctx, layout, this.bg);

    ctx.save();
    clipImage(ctx, layout, this.bg);
    ctx.translate(layout.image.x, layout.image.y);
    ctx.drawImage(base, 0, 0);
    for (const shape of shapes) drawShape(ctx, shape, base);
    if (withChrome && this.draft) drawShape(ctx, this.draft, base);
    ctx.restore();

    if (!withChrome) return;

    ctx.save();
    ctx.translate(layout.image.x, layout.image.y);
    const selected = shapes.find((s) => s.id === this.selectedId);
    if (selected) {
      const b = boundsOf(selected);
      ctx.strokeStyle = '#0a84ff';
      ctx.lineWidth = Math.max(1.5, base.width / 800);
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(b.x - 6, b.y - 6, b.width + 12, b.height + 12);
    }
    if (this.cropRect) {
      const r = this.cropRect;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.rect(0, 0, base.width, base.height);
      ctx.rect(r.x, r.y, r.width, r.height);
      ctx.fill('evenodd');
      ctx.strokeStyle = '#fff';
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(1.5, base.width / 800);
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    }
    ctx.restore();
  }

  private render(): void {
    this.layout = computeLayout(this.doc.base.width, this.doc.base.height, this.bg);
    if (this.canvas.width !== this.layout.width) this.canvas.width = this.layout.width;
    if (this.canvas.height !== this.layout.height) this.canvas.height = this.layout.height;
    this.paint(this.ctx, true);
  }

  private flatten(): HTMLCanvasElement {
    this.commitText();
    const out = createCanvas(this.layout.width, this.layout.height);
    this.paint(get2d(out), false);
    return out;
  }

  private async copy(): Promise<void> {
    try {
      await copyImage(await canvasToBlob(this.flatten()));
      toast('Copied to clipboard');
    } catch (err) {
      toast(`Copy failed: ${(err as Error).message}`, 'error');
    }
  }

  private async save(): Promise<void> {
    downloadBlob(await canvasToBlob(this.flatten()), timestampName('png'));
  }

  private close(result: HTMLCanvasElement | null): void {
    this.root.remove();
    this.resolve(result);
  }
}

function snapAngle(from: Point, to: Point): Point {
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  return { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
}
