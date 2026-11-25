import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const CYRILLIC_RE = /[А-Яа-яЁёІіЇїЄєҐґ]/;

test('Mobile Telegram chat messages render top-to-bottom in chronological order', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?lang=ru');

  const cards = page.locator('.tg-msgs .m');
  await expect(cards).toHaveCount(4);

  const ys = [];
  for (let i = 0; i < 4; i++) {
    const box = await cards.nth(i).boundingBox();
    ys.push(box.y);
  }
  expect(ys[0]).toBeLessThan(ys[1]);
  expect(ys[1]).toBeLessThan(ys[2]);
  expect(ys[2]).toBeLessThan(ys[3]);
});

test('Shorts modal fits within landscape mobile viewport (667x375) without overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto('/?lang=ru');

  await page.locator('.sh[data-short-id="rrxsdUa7pWk"]').click();
  const boxEl = page.locator('.shorts-viewer-box');
  await expect(boxEl).toBeVisible();

  const rect = await boxEl.boundingBox();
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(375);

  await page.keyboard.press('Escape');
  await expect(boxEl).toBeHidden();
});

test('English route /en/ renders zero Cyrillic and passes full WCAG AA axe-core check', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/en/');

  const bodyText = await page.locator('body').innerText();
  expect(CYRILLIC_RE.test(bodyText)).toBe(false);

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});
