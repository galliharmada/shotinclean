import { type Page, expect, test } from '@playwright/test';

const shot = (page: Page, name: string) => page.screenshot({ path: `docs/screenshots/${name}.png` });

const meta = (page: Page) => page.locator('.history-meta span').first();

test.beforeEach(async ({ page }) => {
  // The studio is private now. Seed the local marker that Clerk's listener
  // writes after a real sign-in so the capture tests can run without a browser
  // login.
  await page.addInitScript(() => {
    const id = 'user_e2e_studio';
    const now = Date.now();
    localStorage.setItem(
      'shotinclean.auth.v1',
      JSON.stringify({
        version: 1,
        activeUserId: id,
        users: {
          [id]: {
            id,
            fullName: 'Studio User',
            firstName: 'Studio',
            provider: 'clerk',
            createdAt: now,
            savedAt: now,
            lastSeenAt: now,
          },
        },
      }),
    );
  });
  await page.goto('/#/app');
});

test('screenshot → Quick Access → annotate with background → history', async ({ page }) => {
  await shot(page, '01-home');

  await page.getByRole('button', { name: /Capture Screen/ }).click();
  const card = page.locator('.qa-card').first();
  await expect(card).toBeVisible();
  const [width, height] = (await meta(page).textContent())!.match(/\d+/g)!.map(Number);
  await card.hover();
  await page.waitForTimeout(300); // let the action buttons fade in
  await shot(page, '02-quick-access');

  await card.getByRole('button', { name: 'Annotate' }).click();
  const canvas = page.locator('.editor-canvas');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const at = (fx: number, fy: number) => [box.x + box.width * fx, box.y + box.height * fy] as const;
  const drag = async (from: readonly [number, number], to: readonly [number, number]) => {
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(...to, { steps: 8 });
    await page.mouse.up();
  };

  await page.keyboard.press('a');
  await drag(at(0.75, 0.6), at(0.5, 0.42));
  await page.keyboard.press('r');
  await drag(at(0.06, 0.12), at(0.5, 0.3));
  await page.keyboard.press('p');
  await drag(at(0.22, 0.32), at(0.48, 0.42));
  await page.keyboard.press('n');
  await page.mouse.click(...at(0.06, 0.12));
  await page.mouse.click(...at(0.75, 0.6));
  await page.keyboard.press('t');
  await page.mouse.click(...at(0.55, 0.7));
  await page.keyboard.type('Redacted!');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Background', exact: true }).click();
  await page.locator('.bg-swatch').nth(2).click();
  await shot(page, '03-editor');

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.editor')).toHaveCount(0);
  await expect(page.locator('.history-item')).toHaveCount(1);
  // Background padding (64px each side) proves the edited version replaced the original.
  await expect(meta(page)).toHaveText(`Image · ${width + 128}×${height + 128}`);
});

test('area selection with magnifier, then capture previous area', async ({ page }) => {
  await page.getByRole('button', { name: /Capture Area/ }).click();
  const overlay = page.locator('.area-overlay');
  await expect(overlay).toBeVisible();

  await page.mouse.move(120, 100);
  await page.mouse.down();
  await page.mouse.move(700, 420, { steps: 10 });
  await expect(page.locator('.area-label')).toHaveText('580 × 320');
  await shot(page, '04-area-select');
  await page.mouse.up();

  await expect(meta(page)).toHaveText('Image · 580×320');

  await page.getByRole('button', { name: /Previous Area/ }).click();
  await expect(page.locator('.history-item')).toHaveCount(2);
  await expect(meta(page)).toHaveText('Image · 580×320');
});

test('record video with webcam overlay, then trim', async ({ page }) => {
  await page.getByLabel('3-second countdown').uncheck();
  await page.getByLabel('Webcam overlay').check();

  await page.getByRole('button', { name: /Record Video/ }).click();
  await expect(page.locator('.hud')).toBeVisible();
  await page.waitForTimeout(3_000);
  await shot(page, '05-recording-hud');
  await page.locator('.hud').getByRole('button', { name: 'Stop' }).click();

  await expect(page.locator('.qa-card video')).toHaveCount(1);
  await expect(meta(page)).toHaveText(/Video · 0:0[23]/);

  const blobInfo = await page.evaluate(async () => {
    const src = document.querySelector<HTMLVideoElement>('.qa-card video')!.src;
    const blob = await (await fetch(src)).blob();
    return { type: blob.type, size: blob.size };
  });
  expect(blobInfo.type).toMatch(/^video\/(mp4|webm)/);
  expect(blobInfo.size).toBeGreaterThan(10_000);

  await page.locator('.qa-card').first().getByRole('button', { name: 'Edit' }).click();
  const modal = page.locator('.video-editor');
  await expect(modal).toBeVisible();
  await modal.locator('input[type=range]').first().fill('1');
  await shot(page, '06-video-editor');
  await modal.getByRole('button', { name: 'Export' }).click();
  await expect(modal).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('.history-item')).toHaveCount(2);
});

test('record GIF', async ({ page }) => {
  await page.getByLabel('3-second countdown').uncheck();
  await page.getByRole('button', { name: /Record GIF/ }).click();
  await expect(page.locator('.hud')).toBeVisible();
  await page.waitForTimeout(2_000);
  await page.locator('.hud').getByRole('button', { name: 'Stop' }).click();

  const modal = page.locator('.video-editor');
  await expect(modal).toBeVisible();
  await expect(modal.locator('select').first()).toHaveValue('gif');
  await modal.locator('select').nth(1).selectOption('10');
  await modal.locator('select').nth(2).selectOption('480');
  await modal.getByRole('button', { name: 'Export' }).click();

  await expect(meta(page)).toHaveText(/^GIF/, { timeout: 30_000 });
  const head = await page.evaluate(async () => {
    const src = document.querySelector<HTMLImageElement>('.history-thumb img')!.src;
    const bytes = new Uint8Array(await (await (await fetch(src)).blob()).arrayBuffer());
    return String.fromCharCode(...bytes.slice(0, 6));
  });
  expect(head).toBe('GIF89a');
});

test('capture text (OCR) copies recognized text to the clipboard', async ({ page }) => {
  await page.getByRole('button', { name: /Capture Text/ }).click();
  await expect(page.locator('.area-overlay')).toBeVisible();

  // Chromium's synthetic screen draws a running timestamp in the top-left corner.
  await page.mouse.move(80, 58);
  await page.mouse.down();
  await page.mouse.move(420, 122, { steps: 5 });
  await page.mouse.up();

  await expect(page.locator('.toast').last()).toHaveText(/^Copied \d+ characters/, { timeout: 60_000 });
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/\d+:\d{2}:\d{2}/);
});
