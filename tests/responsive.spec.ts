import { expect, test } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5199';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 2);
}

test.describe('responsive app shell', () => {
  test('mobile drawer is compact, dismissible, and navigation closes it', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
    await expect(page.locator('footer')).toContainText('www.AimerSociety.com');
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Open menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Navigation menu' });
    await expect(drawer).toBeVisible();
    const drawerBox = await drawer.locator('> div').boundingBox();
    expect(drawerBox?.width ?? 999).toBeLessThanOrEqual(300);

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.mouse.click(380, 820);
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await drawer.getByPlaceholder('Search algorithms...').fill('dataset manager');
    await page.getByRole('link', { name: /Dataset Manager/i }).first().click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/\/ml\/lab\/dataset-manager/);
    await expectNoHorizontalOverflow(page);

    expect(consoleErrors.filter(error => !error.includes('Failed to load resource'))).toEqual([]);
  });

  test('dataset controls are mobile friendly and expose next steps', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/ml/supervised/logistic-regression`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('link', { name: 'Go to datasets page' }).first()).toBeVisible();
    await page.getByRole('button', { name: /Load/i }).first().click();
    await expect(page.getByText('Next steps').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Visualize/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Statistics/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Data Grid/i }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('dataset manager puts saved datasets before upload/sample options', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseURL}/ml/lab/dataset-manager`, { waitUntil: 'networkidle' });
    const savedBox = await page.getByText('Saved Datasets').first().boundingBox();
    const uploadBox = await page.getByText('Upload and Save').first().boundingBox();
    expect(savedBox?.y ?? 9999).toBeLessThan(uploadBox?.y ?? 0);
    await expect(page.locator('footer')).toContainText('Artificial Intelligence Medical & Engineering Researchers Society Tools');
    await expectNoHorizontalOverflow(page);
  });

  test('desktop shell still renders with sidebar and footer', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Mega ML Algorithms Suite' })).toBeVisible();
    await expect(page.locator('footer')).toContainText('AI Learning Tools');
    await expectNoHorizontalOverflow(page);
  });
});
