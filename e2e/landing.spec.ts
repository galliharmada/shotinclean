import { type Page, expect, test } from '@playwright/test';

const seedClerkProfile = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const id = 'user_landing_test';
    const now = Date.now();
    localStorage.setItem(
      'shotinclean.auth.v1',
      JSON.stringify({
        version: 1,
        activeUserId: id,
        users: {
          [id]: {
            id,
            fullName: 'Ada Lovelace',
            firstName: 'Ada',
            email: 'ada@example.com',
            provider: 'clerk',
            createdAt: now,
            savedAt: now,
            lastSeenAt: now,
          },
        },
      }),
    );
  });
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
});

test('direct studio URL redirects signed-out visitors to Clerk sign-in', async ({ page }) => {
  await page.goto('/#/app');
  await expect(page).toHaveURL(/#account$/);
  await expect(page.locator('[data-auth-body]')).toContainText('Sign in to open the studio');
});

test('Open the studio prompts sign-in instead of navigating', async ({ page }) => {
  await page.locator('.nav-open').click();
  await expect(page.locator('.toast').last()).toContainText('Sign in with Clerk');
  await expect(page).toHaveURL(/\/$/);
});

test('a Clerk profile unlocks the repo and opens the studio', async ({ page }) => {
  await seedClerkProfile(page);
  await page.reload();

  await expect(page.locator('.nav-signin')).toContainText('Ada');
  await expect(page.locator('[data-repo-action]')).toContainText('Open repository');
  await expect(page.locator('[data-local-provider]')).toHaveText('Clerk');
  await expect(page.locator('[data-local-repo]')).toHaveText('Unlocked');

  await page.locator('[data-auth-body] a[href="#/app"]').click();
  await expect(page).toHaveURL(/#\/app$/);
  await expect(page.locator('.capture-btn')).toHaveCount(8);
});

test('donation opens a QRIS modal with the cropped QR only', async ({ page }) => {
  await page.locator('#support').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Donasi' }).click();

  const dialog = page.locator('dialog[data-donate-modal]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.donate-name')).toHaveText('Gallih Armada');
  const qr = dialog.locator('.donate-qr img');
  await expect(qr).toHaveAttribute('alt', /QRIS/);
  await expect.poll(async () => qr.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(300);

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('mobile navigation opens and links to the account section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-menu]').click();
  await expect(page.locator('[data-menu]')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-mobile-menu]')).toBeVisible();
  await page.locator('[data-mobile-menu] a[href="#account"]').click();
  await expect(page.locator('[data-menu]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#account')).toBeInViewport();
});
