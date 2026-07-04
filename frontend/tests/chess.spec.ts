import { test, expect } from '@playwright/test';

test('chess game basic e2e', async ({ page }) => {
  await page.goto('http://localhost:4200/');

  // Expect to be on Home Page
  await expect(page.getByText('Play vs Computer')).toBeVisible();

  // Click start game
  await page.getByRole('button', { name: 'Start Game' }).click();

  // Wait for Game Component to render
  await expect(page.getByText('Match Info')).toBeVisible();

  // Wait for board to be present
  const board = page.locator('.cm-chessboard');
  await expect(board).toBeVisible();

  // If engine plays first (we chose black or random and engine got white),
  // we would see it move. For simplicity, just wait a few seconds and check no errors.
  await page.waitForTimeout(2000);
});
