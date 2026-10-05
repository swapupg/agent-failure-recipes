import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4365/agent-failure-recipes/';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: true, workers: process.env.CI ? 2 : 4, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.BASE_URL ? undefined : { command: 'npm run preview', url: baseURL, reuseExistingServer: false },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
