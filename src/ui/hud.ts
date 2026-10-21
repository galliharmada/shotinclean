import type { ScreenRecorder } from '../capture/recorder';
import { formatDuration, h, sleep } from '../lib/dom';

/**
 * Full-screen countdown (self-timer / pre-recording). Also mirrors the count
 * into the tab title, since the user is often looking at another window.
 */
export async function countdown(seconds: number, label: string): Promise<void> {
  if (seconds <= 0) return;
  const originalTitle = document.title;
  const number = h('div', { class: 'countdown-number' });
  const overlay = h('div', { class: 'countdown' }, number, h('div', { class: 'countdown-label' }, label));
  document.body.append(overlay);

  try {
    for (let s = seconds; s > 0; s--) {
      number.textContent = String(s);
      document.title = `${s}… ${label}`;
      await sleep(1_000);
    }
  } finally {
    overlay.remove();
    document.title = originalTitle;
  }
}

/** Floating recording controls: elapsed time, pause/resume, stop, discard. */
export function showRecordingHud(recorder: ScreenRecorder): () => void {
  const originalTitle = document.title;
  const time = h('span', { class: 'hud-time' }, '0:00');
  const pauseBtn = h('button', { class: 'hud-btn', onclick: () => togglePause() }, 'Pause');
  const hud = h(
    'div',
    { class: 'hud', role: 'status' },
    h('span', { class: 'hud-dot' }),
    time,
    pauseBtn,
    h('button', { class: 'hud-btn hud-stop', onclick: () => void recorder.stop() }, 'Stop'),
    h('button', { class: 'hud-btn', title: 'Discard recording', onclick: () => recorder.cancel() }, 'Discard'),
  );
  document.body.append(hud);

  function togglePause() {
    if (recorder.state === 'recording') recorder.pause();
    else recorder.resume();
    pauseBtn.textContent = recorder.state === 'paused' ? 'Resume' : 'Pause';
    hud.classList.toggle('paused', recorder.state === 'paused');
  }

  const interval = setInterval(() => {
    if (recorder.state === 'idle') return close();
    const elapsed = formatDuration(recorder.elapsedMs / 1000);
    time.textContent = elapsed;
    document.title = `● ${elapsed} — Recording`;
  }, 250);

  function close() {
    clearInterval(interval);
    hud.remove();
    document.title = originalTitle;
  }

  return close;
}
