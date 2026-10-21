/**
 * A frame clock that keeps firing while the tab is in the background.
 *
 * When you record another window, ShotInClean's own tab is hidden and
 * `requestAnimationFrame`/`setInterval` get throttled to ~1 Hz, which would
 * freeze the composited webcam recording. Timers inside a Worker are not
 * throttled the same way, so we tick from there.
 */
export function startTicker(fps: number, onTick: () => void): () => void {
  const source = `let id = setInterval(() => postMessage(0), ${Math.round(1000 / fps)});
    onmessage = () => clearInterval(id);`;
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const worker = new Worker(url);
  worker.onmessage = onTick;

  return () => {
    worker.postMessage('stop');
    worker.terminate();
    URL.revokeObjectURL(url);
  };
}
