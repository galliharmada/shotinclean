---
name: shotinclean
description: Capture polished, annotated screenshots and GIFs of web UIs from the command line. Use it to show a UI change in a pull request, document a feature, file a bug report, or write release notes. It can screenshot a URL or local page (whole page, viewport, or one element), point arrows and numbered steps at CSS selectors, pixelate or blur secrets, add a CleanShot-style background, record click/type flows as a GIF, and OCR text out of images. Works headless on any OS through Chromium.
---

# ShotInClean

ShotInClean is a screenshot and recording toolkit (a browser take on CleanShot X) with a CLI
built for agents. You describe a shot in JSON. Annotations can target **CSS selectors**
instead of pixel coordinates, so you never have to guess where a button is.

## Setup (once per session)

Pick the first that works and use it as `$SIC` in every command below:

1. **Inside the shotinclean repo:** `npm install && npm run build`, then `SIC="node cli/shotinclean.mjs"`.
2. **Anywhere else:** `SIC="npx -y github:galliharmada/shotinclean"`. The first run installs and builds it.

The CLI needs Chromium. If it reports "No usable Chromium", run
`npx playwright install chromium` or set `CHROMIUM_PATH` to an existing Chrome/Chromium binary.

Every command prints **one JSON line** on stdout: `{"ok":true,...}`. On failure it prints
`{"ok":false,"error":"..."}` on stderr and exits 1. The error names the exact field or selector
that was wrong, so fix that and retry.

## Commands

```bash
$SIC capture <url|file.html> -o out.png [--selector CSS] [--full-page] [--spec JSON] [--background gradient:2]
$SIC annotate <image.png> -o out.png --spec JSON
$SIC record <url|file.html> -o out.gif --actions JSON [--duration 2]
$SIC gif <video.webm> -o out.gif [--fps 12] [--width 800] [--start s] [--end s]
$SIC ocr <image.png>
```

Useful capture flags: `--viewport 1280x800` (default), `--scale 2` (default, retina),
`--dark`, `--hide "#cookie-banner"` (repeatable), `--wait-for ".loaded"`, `--wait 500`,
and `--margin 16` (space around `--selector`).

`--spec` takes inline JSON or a path to a `.json` file. Full schema: [reference/spec.md](reference/spec.md).

## Recipes

**Screenshot a component for a PR, with the new button called out:**

```bash
$SIC capture http://localhost:5173/settings -o pr/settings.png \
  --selector "#api-card" --hide ".cookie-banner" --background gradient:2 \
  --spec '{"annotations":[
    {"type":"pixelate","rect":{"selector":"#secret-key"}},
    {"type":"arrow","to":{"selector":"#save","anchor":"right"}}
  ]}'
```

**Step-by-step guide image (numbered steps on the elements):**

```json
{"annotations":[
  {"type":"counter","at":{"selector":"#email","anchor":"left"}},
  {"type":"counter","at":{"selector":"#password","anchor":"left"}},
  {"type":"counter","at":{"selector":"button[type=submit]","anchor":"left"}}
]}
```

Counters number themselves 1, 2, 3 in order.

**GIF of a flow:**

```bash
$SIC record http://localhost:5173/login -o docs/login.gif --duration 1.5 --viewport 1000x700 \
  --actions '[{"click":"#email"},{"type":["#email","ada@example.com"]},{"click":"button[type=submit]"},{"wait":800}]'
```

Actions: `{"click":css}`, `{"hover":css}`, `{"type":[css,text]}`, `{"press":"Enter"}`,
`{"scroll":pixels}`, `{"wait":ms}`.

**Beautify an existing screenshot:** `$SIC annotate shot.png -o pretty.png --spec '{"background":{"fill":"gradient:5","padding":48}}'`

**Read text from an image:** `$SIC ocr error.png`. This runs offline (bundled Tesseract, English).

## Rules

1. **Always look at the result** (open the PNG or GIF) before you use it. Re-shoot if an
   annotation landed in the wrong place.
2. **Redact before sharing.** If an image shows API keys, tokens, emails, or personal data,
   cover them with `pixelate` or `blur` targeted by selector. Do this even if the user didn't ask.
   Pixelate is safer than blur for short secrets.
3. **Prefer selectors over coordinates.** Coordinates are CSS pixels relative to the captured
   image. They are relative to the top-left of the page or viewport *before* the `--selector`
   crop is applied.
4. Place text next to an element with `{"selector":"...","anchor":"right","offset":[dx,dy]}`
   instead of guessing coordinates.
5. Use `anchor` to aim at an element's edge (`top`, `bottom`, `left`, `right`, corners, `center`).
   An arrow with no `from` places its tail on that side automatically and keeps it inside the image.
6. Wait for content before capturing: use `--wait-for` for a selector that only appears once
   data has loaded, rather than a long `--wait`.
7. Keep GIFs short (1–5 s) and narrow (`--width 600`–`800`). Size grows fast with length.

## Limits

- It captures web pages only (anything Chromium can open, including `file://` and localhost),
  not native desktop apps or the OS screen.
- `gif` can't decode MP4/H.264 in Playwright's Chromium. Convert with ffmpeg first, or use `record`.
- `record` keeps only frames where pixels changed, at most `--fps` of them, so an idle page makes
  a small GIF.
