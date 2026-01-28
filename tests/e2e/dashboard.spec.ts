import { test, expect } from '@playwright/test';

test.describe('Dashboard (Protected)', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
        // Navigate to protected route
        await page.goto('/dashboard');

        // Expect redirect to auth
        await expect(page).toHaveURL(/\/auth/);
        await expect(page.getByRole('heading', { name: /welcome to techmigos/i })).toBeVisible();
    });
});
