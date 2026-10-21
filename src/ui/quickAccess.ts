import { h } from '../lib/dom';
import type { CaptureItem } from '../store/history';

export interface QuickAccessActions {
  copy(item: CaptureItem): void;
  save(item: CaptureItem): void;
  edit(item: CaptureItem): void;
  pin(item: CaptureItem): void;
}

/**
 * The Quick Access Overlay: a stack of thumbnails in the corner after each
 * capture, with one-click actions and drag-out-to-save.
 */
export class QuickAccess {
  private readonly host = h('div', { class: 'quick-access', 'aria-label': 'Recent captures' });
  private readonly cards = new Map<string, { el: HTMLElement; url: string; item: CaptureItem }>();
  private lastClosed: CaptureItem | null = null;

  constructor(private readonly actions: QuickAccessActions) {
    document.body.append(this.host);
  }

  show(item: CaptureItem): void {
    this.removeCard(item.id);

    const url = URL.createObjectURL(item.blob);
    const preview =
      item.kind === 'video'
        ? h('video', { src: url, muted: true, autoplay: true, loop: true, playsinline: true })
        : h('img', { src: url, alt: item.name });

    const action = (label: string, fn: () => void, primary = false) =>
      h('button', { class: primary ? 'qa-btn qa-btn-primary' : 'qa-btn', onclick: fn }, label);

    const isImage = item.kind === 'image' && item.blob.type !== 'image/gif';
    const card = h(
      'div',
      { class: 'qa-card', draggable: true, title: 'Drag into any app or onto the desktop' },
      h('div', { class: 'qa-preview' }, preview),
      h(
        'div',
        { class: 'qa-actions' },
        action(isImage ? 'Annotate' : 'Edit', () => this.actions.edit(item), true),
        isImage ? action('Copy', () => this.actions.copy(item)) : null,
        action('Save', () => this.actions.save(item)),
        isImage ? action('Pin', () => this.actions.pin(item)) : null,
      ),
      h('button', { class: 'qa-close', 'aria-label': 'Close', onclick: () => this.dismiss(item.id) }, '×'),
    );

    card.addEventListener('dragstart', (e) => {
      // Chromium's DownloadURL lets a drag drop a real file into Finder/Explorer and most apps.
      const file = new File([item.blob], item.name, { type: item.blob.type });
      e.dataTransfer?.setData('DownloadURL', `${item.blob.type}:${item.name}:${url}`);
      e.dataTransfer?.setData('text/uri-list', url);
      e.dataTransfer?.items.add(file);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    this.cards.set(item.id, { el: card, url, item });
    this.host.prepend(card);
  }

  /** Re-renders a card after its capture was edited. */
  update(item: CaptureItem): void {
    if (this.cards.has(item.id)) this.show(item);
  }

  /** Closes a card. The capture stays in history; only the overlay goes away. */
  dismiss(id: string): void {
    const card = this.cards.get(id);
    if (!card) return;
    this.lastClosed = card.item;
    this.removeCard(id);
  }

  private removeCard(id: string): void {
    const card = this.cards.get(id);
    if (!card) return;
    card.el.remove();
    URL.revokeObjectURL(card.url);
    this.cards.delete(id);
  }

  /** "Restore recently closed" — brings back the last overlay card. */
  restoreLast(): CaptureItem | null {
    if (this.lastClosed && !this.cards.has(this.lastClosed.id)) this.show(this.lastClosed);
    return this.lastClosed;
  }
}
