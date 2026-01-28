import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('should display login page layout', async ({ page }) => {
        await page.goto('/auth');
        await expect(page).toHaveTitle(/TechMigos ProTask/);
        await expect(page.getByRole('heading', { name: /welcome to techmigos protask/i })).toBeVisible();
        await expect(page.getByLabel('Email', { exact: true })).toBeVisible(); // Using exact to avoid ambiguity if multiple inputs
        await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    });

    test('should toggle between sign in and sign up', async ({ page }) => {
        await page.goto('/auth');
        // Click the Sign Up tab
        const signUpTab = page.getByRole('tab', { name: 'Sign Up' });
        await expect(signUpTab).toBeVisible();
        await signUpTab.click();

        // Check for specific Sign Up button or field
        await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
        await expect(page.getByLabel('Full Name')).toBeVisible();
    });
});
