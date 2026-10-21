import { defineConfig } from '@playwright/test';

/**
 * Headless Chromium has no real screen picker: with these flags
 * getDisplayMedia() resolves with a synthetic test-pattern "screen", and
 * camera/microphone use Chromium's fake devices.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:5199',
    viewport: { width: 1280, height: 800 },
    permissions: ['clipboard-read', 'clipboard-write', 'camera', 'microphone'],
    launchOptions: {
      // Optional override for preinstalled browsers (e.g. CI images).
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
  },
});
