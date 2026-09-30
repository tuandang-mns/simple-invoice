import { expect, test } from '@playwright/test';

const EMAIL = process.env.SEED_USER_EMAIL ?? 'admin@simpleinvoice.dev';
const PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';

test('sign in, create an invoice, find it in the list, open it, sign out', async ({ page }) => {
  const invoiceNumber = `PW-${Date.now().toString(36).toUpperCase()}`;

  // A protected page sends an anonymous user to login, then back after signing in.
  await page.goto('/invoices');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email address').fill(EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/invoices$/);
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();

  // Create: 2 × 150.00, default 10% tax, no discount → 330.00, calculated by the server.
  await page.getByRole('link', { name: 'New invoice' }).click();
  await expect(page.getByRole('heading', { name: 'New invoice' })).toBeVisible();
  await page.getByLabel(/^Invoice number/).fill(invoiceNumber);
  await page.getByLabel(/^Customer name/).fill('Playwright Smoke Pte Ltd');
  await page.getByLabel(/^Customer email/).fill('smoke@example.com');
  await page.getByLabel(/^Item name/).fill('Browser test');
  await page.getByLabel(/^Quantity/).fill('2');
  await page.getByLabel(/^Rate/).fill('150');
  await page.getByRole('button', { name: 'Create invoice' }).click();

  await expect(page.getByText(`Invoice ${invoiceNumber} created`)).toBeVisible();
  await expect(page).toHaveURL(/\/invoices$/);

  // Find it through the search box (server-side search, state kept in the URL).
  await page.getByLabel('Search invoices').fill(invoiceNumber);
  await expect(page).toHaveURL(new RegExp(`keyword=${invoiceNumber}`));
  const row = page.getByRole('row', { name: new RegExp(invoiceNumber) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Draft');

  // Detail shows the stored, server-calculated totals.
  await row.click();
  await expect(page.getByRole('heading', { name: invoiceNumber })).toBeVisible();
  const totals = page.getByLabel('Invoice totals');
  await expect(totals).toContainText('300.00'); // subtotal
  await expect(totals).toContainText('30.00'); // tax
  await expect(totals).toContainText('330.00'); // total

  // Signing out ends the session; the protected page is no longer reachable.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/invoices');
  await expect(page).toHaveURL(/\/login/);
});
