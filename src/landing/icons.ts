/**
 * Phosphor Icons (MIT), imported as raw SVG so the landing page can render
 * icons at build time without a second font request.
 */
import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw';
import arrowUpRight from '@phosphor-icons/core/assets/regular/arrow-up-right.svg?raw';
import browser from '@phosphor-icons/core/assets/regular/browser.svg?raw';
import check from '@phosphor-icons/core/assets/regular/check.svg?raw';
import checkCircle from '@phosphor-icons/core/assets/regular/check-circle.svg?raw';
import cloudSlash from '@phosphor-icons/core/assets/regular/cloud-slash.svg?raw';
import copy from '@phosphor-icons/core/assets/regular/copy.svg?raw';
import crop from '@phosphor-icons/core/assets/regular/crop.svg?raw';
import cursor from '@phosphor-icons/core/assets/regular/cursor.svg?raw';
import devices from '@phosphor-icons/core/assets/regular/devices.svg?raw';
import download from '@phosphor-icons/core/assets/regular/download.svg?raw';
import frameCorners from '@phosphor-icons/core/assets/regular/frame-corners.svg?raw';
import github from '@phosphor-icons/core/assets/regular/github-logo.svg?raw';
import hardDrives from '@phosphor-icons/core/assets/regular/hard-drives.svg?raw';
import heart from '@phosphor-icons/core/assets/regular/heart.svg?raw';
import highlighter from '@phosphor-icons/core/assets/regular/highlighter-circle.svg?raw';
import image from '@phosphor-icons/core/assets/regular/image.svg?raw';
import info from '@phosphor-icons/core/assets/regular/info.svg?raw';
import link from '@phosphor-icons/core/assets/regular/link.svg?raw';
import lock from '@phosphor-icons/core/assets/regular/lock.svg?raw';
import magicWand from '@phosphor-icons/core/assets/regular/magic-wand.svg?raw';
import microphone from '@phosphor-icons/core/assets/regular/microphone.svg?raw';
import monitor from '@phosphor-icons/core/assets/regular/monitor.svg?raw';
import paintBrush from '@phosphor-icons/core/assets/regular/paint-brush.svg?raw';
import play from '@phosphor-icons/core/assets/regular/play.svg?raw';
import pushPin from '@phosphor-icons/core/assets/regular/push-pin.svg?raw';
import record from '@phosphor-icons/core/assets/regular/record.svg?raw';
import scissors from '@phosphor-icons/core/assets/regular/scissors.svg?raw';
import selection from '@phosphor-icons/core/assets/regular/selection.svg?raw';
import shieldCheck from '@phosphor-icons/core/assets/regular/shield-check.svg?raw';
import signIn from '@phosphor-icons/core/assets/regular/sign-in.svg?raw';
import sparkle from '@phosphor-icons/core/assets/regular/sparkle.svg?raw';
import spinner from '@phosphor-icons/core/assets/regular/spinner.svg?raw';
import stack from '@phosphor-icons/core/assets/regular/stack.svg?raw';
import star from '@phosphor-icons/core/assets/regular/star.svg?raw';
import textT from '@phosphor-icons/core/assets/regular/text-t.svg?raw';
import user from '@phosphor-icons/core/assets/regular/user.svg?raw';
import videoCamera from '@phosphor-icons/core/assets/regular/video-camera.svg?raw';
import warningCircle from '@phosphor-icons/core/assets/regular/warning-circle.svg?raw';
import webcam from '@phosphor-icons/core/assets/regular/webcam.svg?raw';
import x from '@phosphor-icons/core/assets/regular/x.svg?raw';

export const icons = {
  arrowRight,
  arrowUpRight,
  browser,
  check,
  checkCircle,
  cloudSlash,
  copy,
  crop,
  cursor,
  devices,
  download,
  frameCorners,
  github,
  hardDrives,
  heart,
  highlighter,
  image,
  info,
  link,
  lock,
  magicWand,
  microphone,
  monitor,
  paintBrush,
  play,
  pushPin,
  record,
  scissors,
  selection,
  shieldCheck,
  signIn,
  sparkle,
  spinner,
  stack,
  star,
  textT,
  user,
  videoCamera,
  warningCircle,
  webcam,
  x,
} as const;

export type IconName = keyof typeof icons;

export function icon(name: IconName, className = ''): string {
  return `<span class="icon${className ? ` ${className}` : ''}" aria-hidden="true">${icons[name]}</span>`;
}
