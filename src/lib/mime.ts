/** Ordered by preference: MP4/H.264 (what CleanShot exports) first, WebM as fallback. */
export const VIDEO_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

export function pickVideoMime(
  isSupported: (type: string) => boolean = (type) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type),
): string | undefined {
  return VIDEO_MIME_CANDIDATES.find(isSupported);
}

export function extensionFor(mime: string): string {
  if (mime.startsWith('video/mp4')) return 'mp4';
  if (mime.startsWith('video/webm')) return 'webm';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/jpeg') return 'jpg';
  return 'png';
}
