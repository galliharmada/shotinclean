import '@fontsource-variable/archivo';
import './styles.css';
import { cropCanvas, selectArea } from './capture/areaSelect';
import { getDisplayStream, grabFrame, isCaptureSupported, stopStream } from './capture/display';
import { type RecordingOptions, type RecordingResult, ScreenRecorder } from './capture/recorder';
import { openEditor } from './editor/editor';
import { pinImage } from './features/pin';
import { recognizeText } from './features/ocr';
import { blobToCanvas, canvasToBlob, copyImage, downloadBlob, formatDuration, h, sleep, timestampName } from './lib/dom';
import { type Rect, fromRelative, toRelative } from './lib/geometry';
import { extensionFor } from './lib/mime';
import { type CaptureItem, configureHistoryScope, history } from './store/history';
import { initials, localAuth, profileScope } from './auth/session';
import { countdown, showRecordingHud } from './ui/hud';
import { QuickAccess } from './ui/quickAccess';
import { toast } from './ui/toast';
import { openVideoEditor } from './video/videoEditor';

// ── Settings ─────────────────────────────────────────────────────────

interface Settings extends RecordingOptions {
  selfTimer: number;
  recordCountdown: boolean;
}

const activeProfile = localAuth.active();
const scope = profileScope(activeProfile);
configureHistoryScope(scope);

const SETTINGS_KEY = scope ? `shotinclean.settings.${scope}` : 'shotinclean.settings';
const PREVIOUS_AREA_KEY = scope ? `shotinclean.previousArea.${scope}` : 'shotinclean.previousArea';

const DEFAULT_SETTINGS: Settings = {
  microphone: false,
  systemAudio: false,
  webcam: false,
  webcamPosition: 'bottom-right',
  fps: 30,
  selfTimer: 5,
  recordCountdown: true,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — settings simply won't persist.
  }
}

const settings: Settings = readJson(SETTINGS_KEY, DEFAULT_SETTINGS);

// ── Capture items ────────────────────────────────────────────────────

async function storeCapture(blob: Blob, meta: Pick<CaptureItem, 'kind' | 'width' | 'height' | 'durationMs'>): Promise<CaptureItem> {
  const item: CaptureItem = {
    id: crypto.randomUUID(),
    blob,
    name: timestampName(extensionFor(blob.type)),
    createdAt: Date.now(),
    ...meta,
  };
  await history.put(item);
  quickAccess.show(item);
  void renderHistory();
  return item;
}

async function storeImage(canvas: HTMLCanvasElement): Promise<CaptureItem> {
  return storeCapture(await canvasToBlob(canvas), { kind: 'image', width: canvas.width, height: canvas.height });
}

const isEditableImage = (item: CaptureItem) => item.kind === 'image' && item.blob.type !== 'image/gif';

const actions = {
  async copy(item: CaptureItem) {
    try {
      await copyImage(item.blob);
      toast('Copied to clipboard');
    } catch (err) {
      toast(`Copy failed: ${(err as Error).message}`, 'error');
    }
  },

  save(item: CaptureItem) {
    downloadBlob(item.blob, item.name);
  },

  async pin(item: CaptureItem) {
    try {
      await pinImage(item.blob, item.width, item.height);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  },

  async edit(item: CaptureItem) {
    if (isEditableImage(item)) {
      const result = await openEditor(await blobToCanvas(item.blob));
      if (!result) return;
      // Edits replace the capture in place, like re-saving in CleanShot's editor.
      const updated: CaptureItem = { ...item, blob: await canvasToBlob(result), width: result.width, height: result.height };
      await history.put(updated);
      quickAccess.update(updated);
      void renderHistory();
      return;
    }

    if (item.kind === 'video') {
      const result = await openVideoEditor(item.blob);
      if (!result) return;
      const { width, height } = item;
      await storeCapture(result.blob, { kind: result.kind === 'gif' ? 'image' : 'video', width, height });
    }
  },
};

const quickAccess = new QuickAccess(actions);

// ── Screenshots ──────────────────────────────────────────────────────

type ScreenshotMode = 'screen' | 'window' | 'area' | 'previous-area' | 'text';

let busy = false;

/** Serializes captures and turns "user closed the picker" into a silent no-op. */
async function guarded(task: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    await task();
  } catch (err) {
    const error = err as DOMException;
    if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
      console.error(err);
      toast(error.message || 'Something went wrong', 'error');
    }
  } finally {
    busy = false;
  }
}

function takeScreenshot(mode: ScreenshotMode, delaySeconds = 0): Promise<void> {
  return guarded(async () => {
    const stream = await getDisplayStream({ surface: mode === 'window' ? 'window' : 'monitor' });
    let frame: HTMLCanvasElement;
    try {
      if (delaySeconds > 0) await countdown(delaySeconds, 'Screenshot');
      // Give the browser a beat to drop the picker and refocus the captured surface.
      else await sleep(300);
      frame = await grabFrame(stream);
    } finally {
      stopStream(stream);
    }

    if (mode === 'area' || mode === 'text') {
      const rect = await selectArea(frame);
      if (!rect) return;
      writeJson(PREVIOUS_AREA_KEY, toRelative(rect, frame.width, frame.height));
      frame = cropCanvas(frame, rect);
    }

    if (mode === 'previous-area') {
      const saved = readJson<Rect | null>(PREVIOUS_AREA_KEY, null);
      if (saved) frame = cropCanvas(frame, fromRelative(saved, frame.width, frame.height));
      else toast('No previous area yet — captured the full screen');
    }

    if (mode === 'text') return captureText(frame);

    await storeImage(frame);
  });
}

async function captureText(frame: HTMLCanvasElement): Promise<void> {
  toast('Recognizing text…');
  const text = await recognizeText(frame);
  if (!text) return toast('No text found', 'error');
  await navigator.clipboard.writeText(text);
  toast(`Copied ${text.length} characters: “${text.slice(0, 60)}${text.length > 60 ? '…' : ''}”`, 'info', 4_000);
}

// ── Recording ────────────────────────────────────────────────────────

function startRecording(output: 'video' | 'gif'): Promise<void> {
  return guarded(async () => {
    const recorder = new ScreenRecorder(settings);
    await recorder.prepare();

    try {
      if (settings.recordCountdown) await countdown(3, output === 'gif' ? 'Recording GIF' : 'Recording');
    } catch (err) {
      recorder.cancel();
      throw err;
    }

    const result = await new Promise<RecordingResult | null>((resolve) => {
      recorder.onStop = resolve;
      recorder.begin();
      const closeHud = showRecordingHud(recorder);
      // A discarded recording never calls onStop; the HUD notices the idle state.
      const watch = setInterval(() => {
        if (recorder.state !== 'idle') return;
        clearInterval(watch);
        closeHud();
        setTimeout(() => resolve(null), 0);
      }, 250);
    });

    if (!result) return toast('Recording discarded');

    toast(`Recorded ${formatDuration(result.durationMs / 1000)}`);
    const meta = { width: result.width, height: result.height, durationMs: result.durationMs };

    if (output === 'gif') {
      const edited = await openVideoEditor(result.blob, 'gif');
      if (edited) await storeCapture(edited.blob, { kind: edited.kind === 'gif' ? 'image' : 'video', ...meta });
      return;
    }

    await storeCapture(result.blob, { kind: 'video', ...meta });
  });
}

// ── Opening existing images (clipboard, drag & drop, file picker) ───

async function openFile(file: Blob): Promise<void> {
  if (file.type.startsWith('image/')) {
    const canvas = await blobToCanvas(file);
    const result = await openEditor(canvas);
    if (result) await storeImage(result);
  } else if (file.type.startsWith('video/')) {
    const edited = await openVideoEditor(file);
    if (edited) await storeCapture(edited.blob, { kind: edited.kind === 'gif' ? 'image' : 'video', width: 0, height: 0 });
  } else {
    toast('Unsupported file type', 'error');
  }
}

async function openFromClipboard(): Promise<void> {
  try {
    for (const entry of await navigator.clipboard.read()) {
      const type = entry.types.find((t) => t.startsWith('image/'));
      if (type) return openFile(await entry.getType(type));
    }
    toast('No image on the clipboard', 'error');
  } catch {
    toast('Clipboard access denied — press ⌘V / Ctrl+V instead', 'error');
  }
}

function pickFile(): void {
  const input = h('input', { type: 'file', accept: 'image/*,video/*' });
  input.addEventListener('change', () => input.files?.[0] && void openFile(input.files[0]));
  input.click();
}

// ── History ──────────────────────────────────────────────────────────

const historyGrid = h('div', { class: 'history-grid' });
const historyUrls: string[] = [];

async function renderHistory(): Promise<void> {
  const items = await history.list();
  historyUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));

  if (items.length === 0) {
    historyGrid.replaceChildren(h('p', { class: 'muted empty' }, 'Your captures will appear here.'));
    return;
  }

  historyGrid.replaceChildren(
    ...items.map((item) => {
      const url = URL.createObjectURL(item.blob);
      historyUrls.push(url);
      const thumb =
        item.kind === 'video'
          ? h('video', { src: url, muted: true, preload: 'metadata' })
          : h('img', { src: url, alt: item.name, loading: 'lazy' });
      const meta =
        item.kind === 'video' && item.durationMs
          ? `Video · ${formatDuration(item.durationMs / 1000)}`
          : `${item.blob.type === 'image/gif' ? 'GIF' : 'Image'} · ${item.width}×${item.height}`;

      const btn = (label: string, fn: () => void) => h('button', { class: 'btn btn-small', onclick: fn }, label);

      return h(
        'article',
        { class: 'history-item' },
        h('button', { class: 'history-thumb', 'aria-label': `Open ${item.name}`, onclick: () => void actions.edit(item) }, thumb),
        h('div', { class: 'history-meta' }, h('span', {}, meta), h('time', {}, new Date(item.createdAt).toLocaleString())),
        h(
          'div',
          { class: 'history-actions' },
          isEditableImage(item) ? btn('Copy', () => void actions.copy(item)) : null,
          btn('Save', () => actions.save(item)),
          isEditableImage(item) ? btn('Pin', () => void actions.pin(item)) : null,
          btn('Overlay', () => quickAccess.show(item)),
          btn('Delete', async () => {
            await history.remove(item.id);
            quickAccess.dismiss(item.id);
            void renderHistory();
          }),
        ),
      );
    }),
  );
}

// ── Shell ────────────────────────────────────────────────────────────

interface CaptureAction {
  label: string;
  hint: string;
  shortcut: string;
  code: string;
  run: () => void;
}

const CAPTURE_ACTIONS: CaptureAction[] = [
  { label: 'Capture Area', hint: 'Freeze, select, magnify', shortcut: '⌥⇧4', code: 'Digit4', run: () => void takeScreenshot('area') },
  { label: 'Capture Screen', hint: 'Entire display', shortcut: '⌥⇧3', code: 'Digit3', run: () => void takeScreenshot('screen') },
  { label: 'Capture Window', hint: 'A single app window', shortcut: '⌥⇧5', code: 'Digit5', run: () => void takeScreenshot('window') },
  { label: 'Previous Area', hint: 'Re-use the last selection', shortcut: '⌥⇧6', code: 'Digit6', run: () => void takeScreenshot('previous-area') },
  { label: 'Self-Timer', hint: 'Delayed screenshot', shortcut: '⌥⇧7', code: 'Digit7', run: () => void takeScreenshot('screen', settings.selfTimer) },
  { label: 'Capture Text', hint: 'OCR to clipboard', shortcut: '⌥⇧2', code: 'Digit2', run: () => void takeScreenshot('text') },
  { label: 'Record Video', hint: 'MP4 / WebM', shortcut: '⌥⇧R', code: 'KeyR', run: () => void startRecording('video') },
  { label: 'Record GIF', hint: 'Optimized GIF', shortcut: '⌥⇧G', code: 'KeyG', run: () => void startRecording('gif') },
];

function settingsPanel(): HTMLElement {
  const persist = () => writeJson(SETTINGS_KEY, settings);
  const toggle = (key: 'microphone' | 'systemAudio' | 'webcam' | 'recordCountdown', label: string) =>
    h(
      'label',
      { class: 'field field-inline' },
      h('input', {
        type: 'checkbox',
        checked: settings[key],
        onchange: (e: Event) => {
          settings[key] = (e.target as HTMLInputElement).checked;
          persist();
        },
      }),
      h('span', {}, label),
    );
  const select = <K extends 'webcamPosition' | 'fps' | 'selfTimer'>(key: K, label: string, options: Array<[Settings[K], string]>) =>
    h(
      'label',
      { class: 'field' },
      h('span', {}, label),
      h(
        'select',
        {
          onchange: (e: Event) => {
            const raw = (e.target as HTMLSelectElement).value;
            (settings[key] as unknown) = typeof settings[key] === 'number' ? Number(raw) : raw;
            persist();
          },
        },
        ...options.map(([value, text]) => h('option', { value: String(value), selected: settings[key] === value }, text)),
      ),
    );

  return h(
    'section',
    { class: 'panel settings' },
    h('h2', {}, 'Recording'),
    toggle('microphone', 'Microphone'),
    toggle('systemAudio', 'System / tab audio'),
    toggle('webcam', 'Webcam overlay'),
    toggle('recordCountdown', '3-second countdown'),
    select('webcamPosition', 'Webcam position', [
      ['bottom-right', 'Bottom right'],
      ['bottom-left', 'Bottom left'],
      ['top-right', 'Top right'],
      ['top-left', 'Top left'],
    ]),
    select('fps', 'Frame rate', [
      [30, '30 fps'],
      [60, '60 fps'],
    ]),
    h('h2', {}, 'Screenshots'),
    select('selfTimer', 'Self-timer', [
      [3, '3 seconds'],
      [5, '5 seconds'],
      [10, '10 seconds'],
    ]),
  );
}

function renderShell(root: HTMLElement): void {
  const grid = h(
    'div',
    { class: 'capture-grid' },
    ...CAPTURE_ACTIONS.map((a) =>
      h(
        'button',
        { class: 'capture-btn', onclick: a.run, disabled: !isCaptureSupported() },
        h('strong', {}, a.label),
        h('span', { class: 'muted' }, a.hint),
        h('kbd', {}, a.shortcut),
      ),
    ),
  );

  const unsupported = isCaptureSupported()
    ? null
    : h('p', { class: 'banner' }, 'This browser cannot capture the screen. Use a desktop Chromium, Firefox or Safari.');

  root.replaceChildren(
    h(
      'header',
      { class: 'app-header' },
      h('a', { class: 'brand', href: '#/', title: 'Back to the ShotInClean site' }, h('span', { class: 'logo' }), 'ShotInClean'),
      h(
        'div',
        { class: 'row' },
        activeProfile
          ? h(
              'a',
              { class: 'profile-chip', href: '#/account', title: 'Your local profile' },
              h('span', { class: 'avatar-xs' }, initials(activeProfile.fullName)),
              h('span', {}, activeProfile.fullName),
            )
          : h('a', { class: 'btn', href: '#/account' }, 'Sign in'),
        h('button', { class: 'btn', onclick: () => void openFromClipboard() }, 'Open from clipboard'),
        h('button', { class: 'btn', onclick: pickFile }, 'Open file…'),
        h('button', { class: 'btn', title: 'Restore recently closed overlay (⌥⇧Z)', onclick: () => quickAccess.restoreLast() }, 'Restore closed'),
      ),
    ),
    h(
      'main',
      { class: 'layout' },
      h('section', { class: 'panel' }, unsupported, grid),
      settingsPanel(),
      h(
        'section',
        { class: 'panel history' },
        h(
          'div',
          { class: 'row row-between' },
          h('h2', {}, 'History'),
          h(
            'button',
            {
              class: 'btn btn-small',
              onclick: async () => {
                if (!confirm('Delete all captures from history?')) return;
                await history.clear();
                void renderHistory();
              },
            },
            'Clear all',
          ),
        ),
        historyGrid,
      ),
    ),
  );
}

function bindGlobalEvents(): void {
  addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (!e.altKey || !e.shiftKey || target.closest('input, textarea, .editor, .modal')) return;
    if (e.code === 'KeyZ') return void quickAccess.restoreLast();
    const action = CAPTURE_ACTIONS.find((a) => a.code === e.code);
    if (!action || !isCaptureSupported()) return;
    e.preventDefault();
    action.run();
  });

  addEventListener('paste', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (file) void openFile(file);
  });

  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files[0];
    // Ignore our own Quick Access cards being dropped back onto the page.
    if (!file || document.querySelector('.qa-card.dragging')) return;
    e.preventDefault();
    void openFile(file);
  });
}

export function bootStudio(root: HTMLElement): void {
  renderShell(root);
  bindGlobalEvents();
  void renderHistory();
}
