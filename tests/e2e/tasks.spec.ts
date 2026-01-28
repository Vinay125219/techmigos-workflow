import { test, expect } from '@playwright/test';

test.describe('Tasks (Protected)', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
        await page.goto('/tasks');
        // Expect redirect to auth
        await expect(page).toHaveURL(/\/auth/);
    });
});
