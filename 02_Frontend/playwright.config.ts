import { defineConfig, devices } from '@playwright/test';

// Tests live in 05_Tests/ — run from there with: npx playwright test
export default defineConfig({
  testDir: '../05_Tests',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  outputDir: '../05_Tests/test-results',
});
