import { expect, test } from '@playwright/test';

test('signup explains a rejected application origin instead of blaming account details', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Origin verification');
  await page.getByLabel('Email address', { exact: true }).fill('origin-check@example.test');
  await page.getByLabel(/^Password/).fill('Local-development-test-password-382!');
  await page.route('**/api/auth/sign-up/email', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'This request did not originate from the application.' }),
    });
  });
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.locator('form').getByRole('alert')).toContainText('BETTER_AUTH_URL');
  await expect(page.locator('form').getByRole('alert')).not.toContainText('Check your details');
});
