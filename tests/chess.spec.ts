import { test, expect } from '@playwright/test';

test('chess game basic e2e', async ({ page }) => {
  await page.goto('http://localhost:4200/');
  const title = await page.title();
  expect(title).toBe('Frontend');
});
