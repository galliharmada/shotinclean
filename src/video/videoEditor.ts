import { downloadBlob, formatDuration, h, timestampName } from '../lib/dom';
import { extensionFor, pickVideoMime } from '../lib/mime';
import { toast } from '../ui/toast';
import { loadVideo, trimVideo, videoToGif } from './media';

export interface VideoEditResult {
  blob: Blob;
  kind: 'video' | 'gif';
}

/**
 * Trim a recording and export it as video or GIF — the browser counterpart
 * of CleanShot's built-in trimming tool and "Record GIF" output.
 */
export async function openVideoEditor(blob: Blob, initialFormat: 'video' | 'gif' = 'video'): Promise<VideoEditResult | null> {
  const url = URL.createObjectURL(blob);
  const video = await loadVideo(url);
  video.controls = true;
  video.className = 'video-preview';
  const duration = video.duration;

  return new Promise((resolve) => {
    let start = 0;
    let end = duration;
    let busy = false;

    const rangeLabel = h('span', { class: 'muted' });
    const progress = h('progress', { max: 1, value: 0, hidden: true });
    const startInput = rangeInput(0, (v) => {
      start = Math.min(v, end - 0.1);
      startInput.value = String(start);
      video.currentTime = start;
      sync();
    });
    const endInput = rangeInput(duration, (v) => {
      end = Math.max(v, start + 0.1);
      endInput.value = String(end);
      video.currentTime = end;
      sync();
    });

    const format = h(
      'select',
      {},
      h('option', { value: 'video', selected: initialFormat === 'video' }, 'Video (MP4/WebM)'),
      h('option', { value: 'gif', selected: initialFormat === 'gif' }, 'GIF'),
    );
    const fps = h('select', {}, ...[10, 15, 20].map((n) => h('option', { value: n, selected: n === 15 }, `${n} fps`)));
    const width = h('select', {}, ...[480, 720, 1080].map((n) => h('option', { value: n, selected: n === 720 }, `${n}px`)));
    const gifOptions = h('div', { class: 'row', hidden: initialFormat !== 'gif' }, fps, width);
    format.addEventListener('change', () => (gifOptions.hidden = format.value !== 'gif'));

    const exportBtn = h('button', { class: 'btn btn-primary', onclick: () => void runExport() }, 'Export');

    function rangeInput(value: number, onInput: (v: number) => void): HTMLInputElement {
      return h('input', {
        type: 'range',
        min: 0,
        max: duration,
        step: 0.01,
        value,
        oninput: (e: Event) => onInput(Number((e.target as HTMLInputElement).value)),
      });
    }

    function sync() {
      rangeLabel.textContent = `${formatDuration(start)} → ${formatDuration(end)} (${(end - start).toFixed(1)}s)`;
      startInput.closest('.trim')?.setAttribute('style', `--a:${start / duration};--b:${end / duration}`);
    }

    // Keep playback inside the trim range.
    video.addEventListener('timeupdate', () => {
      if (!busy && (video.currentTime < start - 0.05 || video.currentTime > end)) video.currentTime = start;
    });

    async function runExport() {
      if (busy) return;
      busy = true;
      exportBtn.disabled = true;
      progress.hidden = false;
      video.controls = false;
      const onProgress = (f: number) => (progress.value = f);

      try {
        if (format.value === 'gif') {
          const gif = await videoToGif(video, {
            start,
            end,
            fps: Number(fps.value),
            maxWidth: Number(width.value),
            onProgress,
          });
          finish({ blob: gif, kind: 'gif' });
        } else if (start <= 0.01 && end >= duration - 0.01) {
          finish({ blob, kind: 'video' });
        } else {
          const mime = pickVideoMime() ?? blob.type;
          finish({ blob: await trimVideo(video, start, end, mime, onProgress), kind: 'video' });
        }
      } catch (err) {
        toast(`Export failed: ${(err as Error).message}`, 'error');
        busy = false;
        exportBtn.disabled = false;
        progress.hidden = true;
        video.controls = true;
      }
    }

    function finish(result: VideoEditResult | null) {
      video.pause();
      URL.revokeObjectURL(url);
      modal.remove();
      resolve(result);
    }

    const modal = h(
      'div',
      { class: 'modal', role: 'dialog', 'aria-label': 'Edit recording' },
      h(
        'div',
        { class: 'modal-card video-editor' },
        h('h2', {}, 'Edit recording'),
        video,
        h(
          'div',
          { class: 'trim' },
          h('label', {}, 'Start', startInput),
          h('label', {}, 'End', endInput),
        ),
        h('div', { class: 'row' }, rangeLabel),
        h('div', { class: 'row' }, format, gifOptions),
        progress,
        h(
          'div',
          { class: 'row row-end' },
          h('button', { class: 'btn', onclick: () => finish(null) }, 'Close'),
          h(
            'button',
            { class: 'btn', onclick: () => downloadBlob(blob, timestampName(extensionFor(blob.type))) },
            'Save original',
          ),
          exportBtn,
        ),
      ),
    );

    document.body.append(modal);
    sync();
  });
}
