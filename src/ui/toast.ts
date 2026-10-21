import { h } from '../lib/dom';

let host: HTMLElement | null = null;

export function toast(message: string, kind: 'info' | 'error' = 'info', ms = 2_600): void {
  host ??= document.body.appendChild(h('div', { class: 'toasts', 'aria-live': 'polite' }));
  const el = h('div', { class: `toast toast-${kind}` }, message);
  host.append(el);
  setTimeout(() => {
    el.classList.add('leaving');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  }, ms);
}
