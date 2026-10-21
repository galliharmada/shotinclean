# How CleanShot X works — research notes

These notes back the feature set of ShotInClean with evidence. They also separate
what is **documented** from what is **inferred**.

> **Method / limitation.** The research ran in a sandbox whose network policy blocks
> `cleanshot.com`, `setapp.com` and most review sites. So the evidence is
> (1) source code fetched directly from GitHub, and (2) web-search excerpts of the
> official docs and independent reviews. Every claim below cites where it came from.

## 1. The command surface (primary evidence: source code)

CleanShot X exposes its whole feature set through a `cleanshot://` URL scheme. The
open-source Raycast extension
[`raycast/extensions/extensions/cleanshotx`](https://github.com/raycast/extensions/tree/main/extensions/cleanshotx)
drives the app only through that scheme, so its manifest is effectively a list of
CleanShot's capabilities. Fetched `package.json` → `commands`:

| Command | Description (verbatim) |
| --- | --- |
| `capture-area` | Selection Tool Capture |
| `capture-previous-area` | Previously Selected Area |
| `capture-fullscreen` | Fullscreen Screenshot |
| `capture-window` | Window Capture |
| `self-timer` | Timer Based Screen Capture |
| `scrolling-capture` | Scrolling Capture Mode |
| `capture-text` | Capture text using OCR |
| `record-screen` | Record Entire Screen |
| `record-screen-preset` | Start a screen recording at a chosen preset resolution |
| `all-in-one` | Capture Record Crop All in One |
| `annotate` | Annotate Mode |
| `open-from-clipboard` | Open Image From Clipboard |
| `pin` | Pin Screenshot to the Screen. |
| `add-quick-access-overlay` / `restore-recently-closed` | Quick Access Overlay management |
| `toggle/hide/show-desktop-icons` | Toggle Desktop Icons Visibility |
| `open-history` / `view-uploads` | Screenshots history / CleanShot Cloud uploads |

Each command is a thin URL open. From `src/capture-area.tsx`:

```ts
const url = "cleanshot://capture-area";
await closeMainWindow();
if (props.arguments?.action) open(url + "?action=" + props.arguments.action);
else open(url);
```

The extension README says the API must be switched on first:
*"Open CleanShot X Settings → Goto Advanced Tab → Toggle API"*.

## 2. Official URL-scheme API (search excerpt of cleanshot.com/docs-api)

- `capture-area` accepts optional `x`, `y`, `width`, `height` and `display`
  (1 = main, 2 = secondary). Point (0,0) is the **lower-left** corner, which is the macOS
  screen coordinate convention.
- An optional `action` runs after capture: `copy | save | annotate | upload | pin`.
- URL-scheme calls go through macOS LaunchServices, so they need a logged-in GUI
  session and do not work headless over SSH.

Source: [cleanshot.com/docs-api](https://cleanshot.com/docs-api), via search results.

## 3. Behaviour (independent reviews)

| Area | What the sources say | Source |
| --- | --- | --- |
| Recording output | Records as GIF or as **MP4 (H.264)**; "optimized GIF" | [OWC blog](https://owc.com/blog/cleanshot-x-is-the-screenshot-utility-built-for-pros), [TechRadar](https://www.techradar.com/reviews/cleanshot-x-for-mac-review) |
| Recording overlays | Shows **clicks and keystrokes**, chosen before recording | [podfeet](https://www.podfeet.com/blog/2026/09/cleanshot-5/) |
| Webcam | Adds the Mac camera as an overlay inside the screencast | [TechRadar](https://www.techradar.com/reviews/cleanshot-x-for-mac-review) |
| Editing | Built-in **trimming tool**; can hand off to an external editor | [OWC blog](https://owc.com/blog/cleanshot-x-is-the-screenshot-utility-built-for-pros) |
| Quick Access Overlay | Pop-up right after every capture to view, annotate or share; **drag & drop** into other apps or onto the desktop | [thesweetbits](https://thesweetbits.com/how-cleanshot-transformed-my-mac-screenshot-game/), [Setapp](https://setapp.com/how-to/no-clutter-screen-capturing-for-mac) |
| Background tool | Wallpaper/solid backgrounds, padding, shadow, transparent option | [PC Watch](https://pc.watch.impress.co.jp/docs/column/macinfo/2112698.html), [leancrew](https://leancrew.com/all-this/2025/01/cleanshot-x-and-retrobatch/) |
| Annotation | Arrows, text, shapes, highlighter, blur/pixelate; v4.7 added a resize tool and a smart highlighter | [hackdesign](https://www.hackdesign.org/toolkit/cleanshot-x/), [AlternativeTo](https://alternativeto.net/news/2024/5/screen-capture-tool-cleanshot-x-releases-v4-7-with-resize-tool-and-smart-highlighter) |
| Other | OCR, cloud upload with share links, pin to screen | Raycast manifest above |

## 4. How it works under the hood (inference, not documented)

CleanShot is closed-source. The following is an informed guess from the macOS
platform, **not** evidence:

- **Capture.** ScreenCaptureKit (macOS 12.3+) or the older `CGWindowListCreateImage`.
  Both give per-window capture with real alpha, which is what makes window shadows
  and transparent backgrounds possible.
- **"Freeze screen" area selection.** Grab a full frame first, then show a borderless
  full-screen window over it for the crosshair, loupe and dimensions.
- **OCR.** Apple's Vision framework (`VNRecognizeTextRequest`) runs on-device.
- **Recording.** ScreenCaptureKit streams into AVFoundation (`AVAssetWriter`, H.264).
  GIFs are made by encoding frames afterwards.
- **Hiding desktop icons.** Toggles Finder's `CreateDesktop` default, or covers the
  desktop with a window.

## 5. Mapping to ShotInClean (browser)

| CleanShot X | ShotInClean implementation |
| --- | --- |
| ScreenCaptureKit capture | `navigator.mediaDevices.getDisplayMedia()` (`src/capture/display.ts`) |
| Hide own UI while capturing | `CaptureController.setFocusBehavior('focus-captured-surface')` |
| Capture area with freeze, crosshair and magnifier | Frame grab + full-viewport overlay with a pixel loupe (`src/capture/areaSelect.ts`) |
| Capture previous area | Last selection stored as relative coordinates in `localStorage` |
| Self-timer | Countdown before the frame grab (also mirrored in the tab title) |
| Annotate | Canvas editor with arrow, line, rect, ellipse, pen, text, highlighter, counter, pixelate, blur, crop, undo/redo (`src/editor/`) |
| Background tool | Gradient, solid or transparent fill, plus padding, radius, shadow and aspect ratio (`src/editor/background.ts`) |
| Record MP4/GIF | `MediaRecorder` (MP4/H.264 when supported, else WebM) + `gifenc` (`src/capture/recorder.ts`, `src/video/media.ts`) |
| Webcam overlay, mic + system audio | Canvas compositing driven by a Worker clock; Web Audio mixing |
| Trim | Replays the chosen range into a `MediaRecorder` (`src/video/videoEditor.ts`) |
| OCR (Vision) | Tesseract.js, self-hosted, fully offline (`src/features/ocr.ts`) |
| Quick Access Overlay, drag & drop | Corner card stack; drag uses Chromium's `DownloadURL` (`src/ui/quickAccess.ts`) |
| Pin to screen | Document Picture-in-Picture (always on top), popup fallback (`src/features/pin.ts`) |
| History | IndexedDB (`src/store/history.ts`) |
| Open from clipboard | Async Clipboard API, paste and drop |

### Not possible in a browser

- **Global hotkeys.** Shortcuts only work while the tab has focus.
- **Click and keystroke overlays** for other apps. A web page can't see input outside itself.
- **Scrolling capture** of other apps. The page can't scroll another window.
- **Hiding desktop icons.** No OS access.
- **Cloud upload.** Left out on purpose. Files stay local (IndexedDB + downloads).

Wrapping ShotInClean in Electron or Tauri would unlock the first four: global
shortcuts, `uiohook` for input, and OS-level window APIs.
