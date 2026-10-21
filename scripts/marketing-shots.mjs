/**
 * Generates marketing screenshots by driving the real studio against a
 * synthetic "designer's desktop" canvas. Run it while Vite is up:
 *   node scripts/marketing-shots.mjs http://127.0.0.1:5173
 *   python3 scripts/optimize-assets.py
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { screenScript } from './fake-screen.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] || 'http://127.0.0.1:5173';
const out = resolve(root, 'src/landing/assets');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  permissions: ['clipboard-read', 'clipboard-write', 'camera', 'microphone'],
});
await context.addInitScript(screenScript);

const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('[page]', msg.text());
});

const exportLatest = async (name, preferWide = 0) => {
  const data = await page.evaluate(async (minimumWidth) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('shotinclean', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const items = await new Promise((resolve, reject) => {
      const req = db.transaction('captures').objectStore('captures').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const images = items.filter((item) => item.kind === 'image').sort((a, b) => b.width - a.width);
    const item = images.find((entry) => entry.width >= minimumWidth) ?? images[0];
    if (!item) throw new Error('no image capture');
    const bytes = new Uint8Array(await item.blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { width: item.width, height: item.height, base64: btoa(binary) };
  }, preferWide);
  await writeFile(`${out}/${name}`, Buffer.from(data.base64, 'base64'));
  console.log(`exported ${name} (${data.width}x${data.height})`);
};

const capture = async () => {
  await page.getByRole('button', { name: /Capture Screen/ }).click();
  const card = page.locator('.qa-card').first();
  await card.waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  return card;
};

await page.goto(`${base}/#/app`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Capture Screen/ }).waitFor();

// 1. Area selection overlay on a clean state
await page.getByRole('button', { name: /Capture Area/ }).click();
await page.locator('.area-overlay').waitFor({ state: 'visible' });
await page.mouse.move(150, 120);
await page.mouse.down();
await page.mouse.move(1040, 610, { steps: 14 });
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/area-select.png` });
await page.keyboard.press('Escape');
await page.mouse.up();
await page.locator('.area-overlay').waitFor({ state: 'detached' });
await page.waitForTimeout(400);

// 2. Quick access card over the app
let card = await capture();
await exportLatest('screen.png');
await page.waitForTimeout(700);
await card.hover();
await page.waitForTimeout(350);
await page.screenshot({ path: `${out}/quick-access.png` });

// 3. Annotation editor with a background
await page.evaluate(() => {
  const button = [...document.querySelectorAll('.qa-card .qa-btn')].find((item) => item.textContent === 'Annotate');
  button?.click();
});
const canvas = page.locator('.editor-canvas');
await canvas.waitFor({ state: 'visible' });
const box = await canvas.boundingBox();
if (!box) throw new Error('editor canvas has no box');
const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
const drag = async (from, to) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 10 });
  await page.mouse.up();
};

await page.keyboard.press('r');
await drag(at(0.44, 0.14), at(0.92, 0.62));
await page.keyboard.press('a');
await drag(at(0.72, 0.78), at(0.53, 0.52));
await page.keyboard.press('n');
await page.mouse.click(...at(0.44, 0.12));
await page.mouse.click(...at(0.8, 0.4));
await page.getByRole('button', { name: 'Background', exact: true }).click();
await page.locator('.bg-swatch').nth(4).click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/editor.png` });
await page.getByRole('button', { name: 'Done' }).click();
await page.locator('.editor').waitFor({ state: 'detached' });
await page.waitForTimeout(400);
await exportLatest('edited.png', 1500);

// 5. Recording HUD
await page.getByLabel('3-second countdown').uncheck();
await page.getByRole('button', { name: /Record Video/ }).click();
await page.locator('.hud').waitFor({ state: 'visible' });
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/recording.png` });
await page.locator('.hud').getByRole('button', { name: 'Stop' }).click();
await page.locator('.qa-card video').first().waitFor({ state: 'visible' });
await page.waitForTimeout(3500);

// 6. Trim editor
const videoCard = page.locator('.qa-card').first();
await videoCard.hover();
await page.waitForTimeout(300);
await videoCard.getByRole('button', { name: 'Edit' }).click();
await page.locator('.video-editor').waitFor({ state: 'visible' });
await page.waitForTimeout(350);
await page.screenshot({ path: `${out}/video-editor.png` });
await page.locator('.video-editor').getByRole('button', { name: 'Close' }).click();
await page.locator('.video-editor').waitFor({ state: 'detached' });

// 7. Studio with history
await page.screenshot({ path: `${out}/studio-history.png` });

await browser.close();
console.log(`Marketing shots written to ${out}`);
