interface DocumentPictureInPicture {
  requestWindow(options: { width: number; height: number }): Promise<Window>;
}

const PIN_STYLES = `
  html, body { margin: 0; height: 100%; background: #111; overflow: hidden; }
  img { width: 100%; height: 100%; object-fit: contain; display: block; transform-origin: center; cursor: zoom-in; }
  .hint { position: fixed; bottom: 6px; left: 50%; transform: translateX(-50%); font: 11px system-ui;
          color: #fff; background: rgba(0,0,0,.55); padding: 3px 8px; border-radius: 6px; opacity: 0; transition: opacity .2s; }
  body:hover .hint { opacity: 1; }
`;

/**
 * Pins a screenshot in an always-on-top floating window (CleanShot's "Pin
 * to screen"). Uses Document Picture-in-Picture where available (Chromium
 * 116+), otherwise a small popup window.
 */
export async function pinImage(blob: Blob, width: number, height: number): Promise<void> {
  const scale = Math.min(1, 480 / width, 360 / height);
  const size = { width: Math.round(width * scale), height: Math.round(height * scale) };
  const pip = (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;

  const win = pip
    ? await pip.requestWindow(size)
    : window.open('', '_blank', `popup,width=${size.width},height=${size.height}`);
  if (!win) throw new Error('Pop-up blocked — allow pop-ups to pin screenshots.');

  const url = URL.createObjectURL(blob);
  const doc = win.document;
  doc.title = 'Pinned screenshot';
  doc.head.append(Object.assign(doc.createElement('style'), { textContent: PIN_STYLES }));

  const img = Object.assign(doc.createElement('img'), { src: url, alt: 'Pinned screenshot' });
  const hint = Object.assign(doc.createElement('div'), {
    className: 'hint',
    textContent: 'Scroll to zoom · ⌥ scroll for opacity · double-click to close',
  });
  doc.body.append(img, hint);

  let zoom = 1;
  let opacity = 1;
  doc.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (e.altKey) {
        opacity = Math.min(1, Math.max(0.2, opacity - Math.sign(e.deltaY) * 0.1));
        img.style.opacity = String(opacity);
      } else {
        zoom = Math.min(8, Math.max(1, zoom - Math.sign(e.deltaY) * 0.2));
        img.style.transform = `scale(${zoom})`;
      }
    },
    { passive: false },
  );
  doc.addEventListener('dblclick', () => win.close());
  win.addEventListener('pagehide', () => URL.revokeObjectURL(url));
}
