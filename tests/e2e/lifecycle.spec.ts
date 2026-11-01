import { expect, test } from '@playwright/test';

test.describe('event planning lifecycle', () => {
  test('opens the product and advances through the event wizard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /your big moments deserve/i })).toBeVisible();

    await page.goto('/events/new');
    await expect(page.getByRole('heading', { name: /what are you planning/i })).toBeVisible();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByRole('heading', { name: /set the essentials/i })).toBeVisible();
    await expect(page.getByLabel('Event name')).toBeVisible();
  });

  test('creates a birthday plan and opens its workspace', async ({ page }) => {
    const title = `Browser lifecycle ${Date.now()}`;

    await page.goto('/events/new');
    await page.getByRole('button', { name: /birthday/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByLabel('Event name').fill(title);
    await page.getByLabel('Event date').fill('2027-01-15');
    await page.getByLabel('Expected guests').fill('20');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByLabel('Budget amount').fill('25000');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByRole('heading', { name: /review your plan brief/i })).toBeVisible();

    await page.getByRole('button', { name: /create event plan/i }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/i);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('link', { name: /ideas/i })).toBeVisible();
  });
});
