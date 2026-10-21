import { describe, expect, it } from 'vitest';
import { extensionFor, pickVideoMime } from '../src/lib/mime';

describe('pickVideoMime', () => {
  it('prefers MP4 when the browser can record it', () => {
    expect(pickVideoMime(() => true)).toMatch(/^video\/mp4/);
  });

  it('falls back to WebM', () => {
    expect(pickVideoMime((t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus');
  });

  it('returns undefined when nothing is supported', () => {
    expect(pickVideoMime(() => false)).toBeUndefined();
  });
});

describe('extensionFor', () => {
  it.each([
    ['video/mp4;codecs=avc1', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['image/gif', 'gif'],
    ['image/png', 'png'],
  ])('%s → %s', (mime, ext) => expect(extensionFor(mime)).toBe(ext));
});
