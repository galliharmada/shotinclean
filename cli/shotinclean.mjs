#!/usr/bin/env node
// ShotInClean CLI: the agent-facing side of the app.
//
// It serves the built app (dist/) on a local port, opens the headless engine
// page in Chromium via Playwright, and calls window.shotinclean.* so every
// render goes through the exact code the interactive editor uses.

import { createReadStream, existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const HELP = `shotinclean — screenshots, annotations, GIFs and OCR for agents

Usage:
  shotinclean capture <url> -o out.png [options]   Screenshot a page (http(s):// or a local file)
  shotinclean annotate <image> -o out.png --spec <json|file>
  shotinclean record <url> -o out.gif [options]    Run actions on a page and record a GIF
  shotinclean gif <video> -o out.gif [--fps 12] [--width 800] [--start s] [--end s]
  shotinclean ocr <image>                          Print recognized text

Capture options:
  --selector <css>      Capture only this element (crop to its box)
  --margin <px>         Extra space around --selector (default 16)
  --full-page           Capture the whole scrollable page
  --viewport <WxH>      Viewport size in CSS px (default 1280x800)
  --scale <n>           Device scale factor (default 2)
  --dark                Emulate prefers-color-scheme: dark
  --hide <css>          Hide matching elements (repeatable), e.g. cookie banners
  --wait <ms>           Extra wait after load
  --wait-for <css>      Wait until this selector is visible
  --spec <json|file>    Annotations/background spec (see SKILL.md); in capture,
                        any point or rect may be {"selector": "..."} instead of numbers
  --background [fill]   Shorthand for a background: gradient[:1-6] | #hex | transparent

Record options:
  --duration <s>        Seconds to keep recording after actions (default 3)
  --actions <json|file> Steps: [{"click":"css"},{"type":["css","text"]},{"press":"Enter"},
                        {"hover":"css"},{"scroll":600},{"wait":500}]
  --fps, --width        GIF max frame rate and max width (default 12, 800)
  --hide, --wait-for, --viewport, --dark   as for capture

Every command prints one JSON line describing the result.`;

// ── Small utilities ──────────────────────────────────────────────────

class UsageError extends Error {}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.gz': 'application/gzip',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

/** `--spec` accepts inline JSON or a path to a JSON file. */
async function readJsonArg(value, name) {
  if (value === undefined) return undefined;
  const text = /^\s*[[{]/.test(value) ? value : await readFile(value, 'utf8');
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new UsageError(`--${name} is not valid JSON: ${err.message}`);
  }
}

function parseViewport(value = '1280x800') {
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) throw new UsageError(`--viewport must look like 1280x800, got "${value}"`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function toUrl(target) {
  if (/^[a-z]+:\/\//i.test(target)) return target;
  if (existsSync(target)) return pathToFileURL(resolve(target)).href;
  throw new UsageError(`"${target}" is neither a URL nor an existing file`);
}

function requireOutput(values, ...extensions) {
  const out = values.out;
  if (!out) throw new UsageError('missing -o/--out');
  if (!extensions.includes(extname(out).toLowerCase())) {
    throw new UsageError(`--out must end with ${extensions.join(' or ')}`);
  }
  return resolve(out);
}

// ── Engine: static server + headless page ────────────────────────────

/** Serves dist/ plus explicitly registered input files under /__input/<n>. */
async function startServer() {
  if (!existsSync(join(DIST, 'headless.html'))) {
    throw new Error(`Engine not built. Run "npm run build" in ${ROOT} first.`);
  }

  const inputs = new Map();
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.startsWith('/__input/') ? inputs.get(path) : join(DIST, path === '/' ? 'index.html' : path);

    if (!file || !file.startsWith(path.startsWith('/__input/') ? '/' : DIST) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });

  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;

  return {
    origin,
    /** Makes a local file fetchable by the engine page and returns its URL. */
    expose(file) {
      const key = `/__input/${inputs.size}${extname(file)}`;
      inputs.set(key, resolve(file));
      return origin + key;
    },
    close: () => new Promise((done) => server.close(done)),
  };
}

async function launchBrowser() {
  const { chromium } = await import('playwright');
  const attempts = [
    process.env.CHROMIUM_PATH && { executablePath: process.env.CHROMIUM_PATH },
    {}, // Playwright's own Chromium
    { channel: 'chrome' }, // system Chrome
  ].filter(Boolean);

  let lastError;
  for (const options of attempts) {
    try {
      return await chromium.launch(options);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `No usable Chromium. Run "npx playwright install chromium" or set CHROMIUM_PATH.\n${lastError?.message ?? ''}`,
  );
}

async function openEngine(browser, server) {
  const page = await browser.newPage();
  page.on('pageerror', (err) => process.stderr.write(`[engine] ${err.message}\n`));
  await page.goto(`${server.origin}/headless.html`);
  await page.waitForFunction(() => 'shotinclean' in window);
  return page;
}

async function writeBase64(file, base64) {
  await writeFile(file, Buffer.from(base64, 'base64'));
}

// ── Selector resolution (capture only) ───────────────────────────────

/**
 * Replaces {"selector": "..."} points and rects in a spec with numbers in
 * CSS px, relative to the captured image.
 */
async function resolveSelectors(page, spec, origin) {
  const box = async (selector) => {
    const locator = page.locator(selector);
    if ((await locator.count()) === 0) throw new UsageError(`selector "${selector}" matched nothing`);
    const b = await locator.first().boundingBox();
    if (!b) throw new UsageError(`selector "${selector}" matched nothing visible`);
    return { x: b.x + origin.x, y: b.y + origin.y, width: b.width, height: b.height };
  };

  const toRect = async (value) => {
    if (!value?.selector) return value;
    const b = await box(value.selector);
    const pad = value.pad ?? 6;
    return [b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2];
  };

  const ANCHORS = {
    center: [0.5, 0.5],
    top: [0.5, 0],
    bottom: [0.5, 1],
    left: [0, 0.5],
    right: [1, 0.5],
    'top-left': [0, 0],
    'top-right': [1, 0],
    'bottom-left': [0, 1],
    'bottom-right': [1, 1],
  };
  const toPoint = async (value) => {
    if (!value?.selector) return value;
    const b = await box(value.selector);
    const anchor = ANCHORS[value.anchor ?? 'center'];
    if (!anchor) throw new UsageError(`unknown anchor "${value.anchor}"; use ${Object.keys(ANCHORS).join(', ')}`);
    const [dx, dy] = value.offset ?? [0, 0];
    return [b.x + b.width * anchor[0] + dx, b.y + b.height * anchor[1] + dy];
  };

  // An arrow aimed at an element's edge gets its tail on that side, so the shaft never crosses the element.
  const ANCHOR_DIRECTIONS = {
    top: 'up',
    bottom: 'down',
    left: 'left',
    right: 'right',
    'top-left': 'up-left',
    'top-right': 'up-right',
    'bottom-left': 'down-left',
    'bottom-right': 'down-right',
  };

  const annotations = [];
  for (const a of spec.annotations ?? []) {
    const direction = a.direction ?? (a.type === 'arrow' && !a.from ? ANCHOR_DIRECTIONS[a.to?.anchor] : undefined);
    annotations.push({
      ...a,
      ...(direction && { direction }),
      ...(a.from && { from: await toPoint(a.from) }),
      ...(a.to && { to: await toPoint(a.to) }),
      ...(a.at && { at: await toPoint(a.at) }),
      ...(a.rect && { rect: await toRect(a.rect) }),
    });
  }
  return { ...spec, ...(spec.crop && { crop: await toRect(spec.crop) }), annotations };
}

function withBackgroundFlag(spec, flag) {
  if (flag === undefined) return spec;
  const fill = flag === '' || flag === 'true' ? undefined : flag;
  return { ...spec, background: { ...(typeof spec.background === 'object' ? spec.background : {}), ...(fill && { fill }) } };
}

// ── Commands ─────────────────────────────────────────────────────────

async function capture(browser, server, [target], values) {
  if (!target) throw new UsageError('capture needs a URL or file');
  const out = requireOutput(values, '.png');
  const viewport = parseViewport(values.viewport);
  const scale = Number(values.scale ?? 2);

  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    colorScheme: values.dark ? 'dark' : 'light',
  });
  try {
    const page = await context.newPage();
    await page.goto(toUrl(target), { waitUntil: 'load' });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    for (const selector of values.hide ?? []) {
      await page.addStyleTag({ content: `${selector} { visibility: hidden !important; }` });
    }
    if (values['wait-for']) await page.locator(values['wait-for']).first().waitFor({ state: 'visible' });
    if (values.wait) await page.waitForTimeout(Number(values.wait));

    let spec = withBackgroundFlag((await readJsonArg(values.spec, 'spec')) ?? {}, values.background);
    let fullPage = Boolean(values['full-page']);

    if (values.selector) {
      if ((await page.locator(values.selector).count()) === 0) {
        throw new UsageError(`--selector "${values.selector}" matched nothing`);
      }
      const element = page.locator(values.selector).first();
      await element.scrollIntoViewIfNeeded().catch(() => {});
      const b = await element.boundingBox();
      if (!b) throw new UsageError(`--selector "${values.selector}" matched nothing visible`);
      // Elements taller/wider than the viewport need a full-page shot to be complete.
      if (b.height > viewport.height || b.width > viewport.width) fullPage = true;
      const margin = Number(values.margin ?? 16);
      spec = { ...spec, crop: { selector: values.selector, pad: margin } };
    }

    // Full-page images use document coordinates; viewport images use viewport coordinates.
    const origin = fullPage
      ? await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
      : { x: 0, y: 0 };
    spec = { ...(await resolveSelectors(page, spec, origin)), scale };

    const tmp = await mkdtemp(join(tmpdir(), 'shotinclean-'));
    try {
      const raw = join(tmp, 'raw.png');
      await page.screenshot({ path: raw, fullPage });
      return await renderTo(browser, server, raw, spec, out);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  } finally {
    await context.close();
  }
}

async function renderTo(browser, server, imagePath, spec, out) {
  const engine = await openEngine(browser, server);
  const result = await engine.evaluate(([url, s]) => window.shotinclean.render(url, s), [server.expose(imagePath), spec]);
  await writeBase64(out, result.png);
  return { output: out, width: result.width, height: result.height };
}

async function annotate(browser, server, [input], values) {
  if (!input || !existsSync(input)) throw new UsageError('annotate needs an existing image file');
  const out = requireOutput(values, '.png');
  const spec = withBackgroundFlag((await readJsonArg(values.spec, 'spec')) ?? {}, values.background);
  return renderTo(browser, server, input, spec, out);
}

async function ocr(browser, server, [input]) {
  if (!input || !existsSync(input)) throw new UsageError('ocr needs an existing image file');
  const engine = await openEngine(browser, server);
  const text = await engine.evaluate((url) => window.shotinclean.ocr(url), server.expose(input));
  return { text };
}

async function toGif(browser, server, videoPath, out, values, start) {
  const engine = await openEngine(browser, server);
  const request = {
    start: values.start !== undefined ? Number(values.start) : start,
    end: values.end !== undefined ? Number(values.end) : undefined,
    fps: Number(values.fps ?? 12),
    width: Number(values.width ?? 800),
  };
  const result = await engine.evaluate(([url, r]) => window.shotinclean.gif(url, r), [server.expose(videoPath), request]);
  await writeBase64(out, result.gif);
  return { output: out, frames: result.frames };
}

async function gif(browser, server, [input], values) {
  if (!input || !existsSync(input)) throw new UsageError('gif needs an existing video file');
  return toGif(browser, server, input, requireOutput(values, '.gif'), values, 0);
}

async function runActions(page, actions) {
  for (const step of actions) {
    const [kind, arg] = Object.entries(step)[0] ?? [];
    switch (kind) {
      case 'click':
        await page.locator(arg).first().click();
        break;
      case 'hover':
        await page.locator(arg).first().hover();
        break;
      case 'type':
        await page.locator(arg[0]).first().pressSequentially(arg[1], { delay: 60 });
        break;
      case 'press':
        await page.keyboard.press(arg);
        break;
      case 'scroll':
        await page.mouse.wheel(0, Number(arg));
        break;
      case 'wait':
        await page.waitForTimeout(Number(arg));
        continue;
      default:
        throw new UsageError(`unknown action ${JSON.stringify(step)}`);
    }
    // A short beat after each step keeps the GIF readable.
    await page.waitForTimeout(400);
  }
}

/**
 * Records with Chromium's CDP screencast instead of Playwright's
 * recordVideo, so no ffmpeg is needed: JPEG frames go straight to the
 * engine's GIF encoder with their real timing.
 */
async function record(browser, server, [target], values) {
  if (!target) throw new UsageError('record needs a URL or file');
  const out = requireOutput(values, '.gif');
  const viewport = parseViewport(values.viewport);
  const actions = (await readJsonArg(values.actions, 'actions')) ?? [];
  const fps = Number(values.fps ?? 12);
  const tmp = await mkdtemp(join(tmpdir(), 'shotinclean-'));

  const context = await browser.newContext({ viewport, colorScheme: values.dark ? 'dark' : 'light' });
  try {
    const page = await context.newPage();
    await page.goto(toUrl(target), { waitUntil: 'load' });
    for (const selector of values.hide ?? []) {
      await page.addStyleTag({ content: `${selector} { visibility: hidden !important; }` });
    }
    if (values['wait-for']) await page.locator(values['wait-for']).first().waitFor({ state: 'visible' });

    const cdp = await context.newCDPSession(page);
    const frames = [];
    const writes = [];
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const file = join(tmp, `${String(frames.length).padStart(5, '0')}.jpg`);
      frames.push({ file, time: metadata.timestamp });
      writes.push(writeFile(file, Buffer.from(data, 'base64')));
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85 });

    await page.waitForTimeout(300);
    await runActions(page, actions);
    await page.waitForTimeout(Number(values.duration ?? 3) * 1000);
    const endTime = Date.now() / 1000;
    await cdp.send('Page.stopScreencast');
    await Promise.all(writes);

    // The screencast only emits frames when pixels change; keep at most `fps`
    // frames per second and stretch each one until the next kept frame.
    const kept = frames.reduce((acc, f) => {
      if (acc.length === 0 || f.time - acc[acc.length - 1].time >= 1 / fps) acc.push(f);
      return acc;
    }, []);
    if (kept.length === 0) throw new Error('No frames captured');
    const lastTime = Math.max(endTime, kept[kept.length - 1].time);
    const timeline = kept.map((f, i) => ({
      url: server.expose(f.file),
      delayMs: Math.max(20, Math.round(((kept[i + 1]?.time ?? lastTime) - f.time) * 1000)),
    }));

    const engine = await openEngine(browser, server);
    const result = await engine.evaluate(([t, w]) => window.shotinclean.gifFromFrames(t, w), [
      timeline,
      Number(values.width ?? 800),
    ]);
    await writeBase64(out, result.gif);
    return { output: out, frames: timeline.length, seconds: Number((lastTime - kept[0].time).toFixed(2)) };
  } finally {
    await context.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

const COMMANDS = { capture, annotate, record, gif, ocr };

// ── Entry point ──────────────────────────────────────────────────────

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      spec: { type: 'string' },
      background: { type: 'string' },
      selector: { type: 'string' },
      margin: { type: 'string' },
      'full-page': { type: 'boolean' },
      viewport: { type: 'string' },
      scale: { type: 'string' },
      dark: { type: 'boolean' },
      hide: { type: 'string', multiple: true },
      wait: { type: 'string' },
      'wait-for': { type: 'string' },
      duration: { type: 'string' },
      actions: { type: 'string' },
      fps: { type: 'string' },
      width: { type: 'string' },
      start: { type: 'string' },
      end: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  const [name, ...args] = positionals;
  if (values.help || !name) {
    console.log(HELP);
    return;
  }
  const command = COMMANDS[name];
  if (!command) throw new UsageError(`unknown command "${name}"`);

  const server = await startServer();
  const browser = await launchBrowser();
  try {
    console.log(JSON.stringify({ ok: true, command: name, ...(await command(browser, server, args, values)) }));
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((err) => {
  // Engine errors arrive as "page.evaluate: SpecError: …\n    at …"; keep the useful part.
  const message = err.message.split('\n    at ')[0].replace(/^page\.evaluate: /, '');
  console.error(JSON.stringify({ ok: false, error: message }));
  if (err instanceof UsageError) console.error('Run "shotinclean --help" for usage.');
  process.exit(1);
});
