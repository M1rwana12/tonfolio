import { expect, test } from '@playwright/test';

// Happy path: open the Mini App → see the dashboard → create an alert →
// see it in the list → clean it up through the UI.
test('dashboard renders and a price alert can be created and removed', async ({ page }) => {
  await page.goto('/');

  const total = page.getByTestId('total-usd');
  await expect(total).toBeVisible();
  await expect(total).toHaveText(/^\$[\d,]+/, { timeout: 30_000 });

  await page.goto('/alerts');
  await page.getByTestId('alert-create-open').click();
  await expect(page.getByTestId('alert-form')).toBeVisible();

  await page.getByTestId('alert-price').fill('9.99');
  await page.getByTestId('alert-submit').click();

  const list = page.getByTestId('alert-list');
  await expect(list).toContainText('≥ $9.99');

  // cleanup through the UI delete button of the created alert
  const row = list.locator('> *').filter({ hasText: '≥ $9.99' }).last();
  await row.getByRole('button').last().click();
  await expect(list).not.toContainText('≥ $9.99');
});
