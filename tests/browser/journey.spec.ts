import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const ids = ['duplicate-action', 'premature-done', 'retry-storm'];
for (const id of ids) test(`${id}: fail, inspect, repair, export, share, refresh`, async ({ page }) => {
  await page.goto(`./#/recipe/${id}/1/ready`);
  await expect(page.getByRole('button', { name: 'Run the failure' })).toBeVisible();
  await page.getByRole('button', { name: 'Run the failure' }).click();
  await expect(page.locator('.outcome.fail')).toContainText('FAIL');
  await page.locator('[data-event="0"]').click();
  await expect(page.locator('#state-label')).toHaveText('State after step 1');
  await page.getByRole('button', { name: 'Apply repair & compare' }).click();
  await expect(page.locator('.outcome.pass')).toContainText('PASS');
  await expect(page.locator('.outcome.fail')).toBeVisible();
  const evidencePromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download run evidence' }).click();
  const evidence = await evidencePromise;
  const result = JSON.parse(readFileSync((await evidence.path())!, 'utf8'));
  expect(result.recipe).toBe(id); expect(result.variant).toBe('repaired'); expect(result.check.passed).toBe(true);
  await page.getByRole('button', { name: 'Get the test' }).click();
  await expect(page.locator('#test-code')).toContainText("from '../src/index.js'");
  const codePromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download test', exact: true }).click();
  expect((await codePromise).suggestedFilename()).toBe(`${id}.test.ts`);
  await page.getByText('Share this recipe', { exact: true }).click();
  await expect(page.locator('#share-url')).toHaveValue(new RegExp(`${id}/1/repaired$`));
  await page.reload(); await expect(page.locator('.outcome.pass')).toContainText('PASS');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('.outcomes')).toHaveCount(0);
  await page.goBack(); await expect(page.locator('.outcome.pass')).toBeVisible();
  await page.goForward(); await expect(page.getByRole('button', { name: 'Run the failure' })).toBeVisible();
});

test('storage and clipboard failure remain recoverable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) } });
  });
  await page.goto('./');
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await page.getByText('Share this recipe', { exact: true }).click();
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.locator('#share-status')).toContainText('Clipboard unavailable');
  await expect(page.locator('#share-url')).toBeFocused();
  await page.getByRole('button', { name: 'Get the test' }).click();
  await page.getByRole('button', { name: 'Copy test', exact: true }).click();
  await expect(page.locator('#code-fallback')).toBeFocused();
  await expect(page.locator('#code-fallback')).toHaveValue(/createTicketFixture/);
});

test('malformed link and recipe switching recover without stale evidence', async ({ page }) => {
  await page.goto('./#/recipe/unknown/99/repaired');
  await expect(page.locator('#route-error')).toBeVisible();
  await page.locator('.recipe-card').nth(1).click();
  await expect(page.locator('#route-error')).toBeHidden();
  await page.getByRole('button', { name: 'Run the failure' }).click();
  await expect(page.locator('.outcome.fail')).toContainText('job is accepted');
  await page.locator('.recipe-card').nth(2).click();
  await expect(page.locator('#state-json')).toHaveText('No run yet.');
});

test('accessibility, themes and narrow layouts', async ({ page }) => {
  await page.goto('./#/recipe/duplicate-action/1/repaired');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(audit.violations).toEqual([]);
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Run repaired again' })).toBeVisible();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
});

test('keyboard can run the main journey', async ({ page, browserName }) => {
  await page.goto('./');
  // macOS WebKit uses Option+Tab to include links in its native navigation order.
  const tab = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(tab); await expect(page.getByText('Skip to recipe', { exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press(tab); await expect(page.getByRole('button', { name: 'Run the failure' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('.outcome.fail')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply repair & compare' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('.outcome.pass')).toBeVisible();
});

test('static instructions remain usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage(); await page.goto(test.info().project.use.baseURL!);
  await expect(page.locator('noscript .notice')).toBeVisible();
  await expect(page.locator('noscript .notice')).toContainText('The interactive lab needs JavaScript.');
  await expect(page.locator('.quickstart pre')).toContainText('npm run check');
  await expect(page.locator('noscript a')).toHaveAttribute('href', 'https://github.com/swapupg/agent-failure-recipes');
  await context.close();
});
