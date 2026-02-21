import { test, expect } from '@playwright/test';

test('redirects unauthenticated users to auth page for protected routes', async ({ page }) => {
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/auth/);
});
