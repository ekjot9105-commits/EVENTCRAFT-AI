import { expect, test } from '@playwright/test';

test.describe('event planning lifecycle', () => {
  test.describe.configure({ timeout: 60_000 });

  async function createEventViaApi(page: import('@playwright/test').Page, type: 'wedding' | 'birthday' | 'community') {
    const title = `Browser ${type} ${Date.now()}`;
    const response = await page.request.post('/api/events', {
      data: {
        type,
        title,
        date: '2027-01-15T10:00:00.000Z',
        guest_count: 20,
        budget_amount: 25000,
        currency: 'USD',
      },
    });
    expect(response.ok()).toBeTruthy();
    return { id: (await response.json()).id as string, title };
  }

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

  test('opens every planning workspace for all three event types and persists records', async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.accept());
    for (const type of ['wedding', 'birthday', 'community'] as const) {
      const event = await createEventViaApi(page, type);

      await page.goto(`/events/${event.id}/budget`);
      await expect(page.getByRole('heading', { name: /budget workspace/i })).toBeVisible();
      await page.getByLabel('Category').fill('Venue');
      await page.getByLabel('Item name').fill(`${type} venue`);
      await page.getByLabel(/^Estimated cost/i).fill('1000');
      await page.getByRole('button', { name: /add expense/i }).click();
      await expect(page.getByText(`${type} venue`)).toBeVisible();
      await page.getByRole('button', { name: `Edit ${type} venue` }).click();
      await page.getByLabel('Item name').fill(`${type} venue updated`);
      await page.getByRole('button', { name: /save changes/i }).click();
      await expect(page.getByText(`${type} venue updated`)).toBeVisible();
      await page.getByRole('button', { name: `Delete ${type} venue updated` }).click();
      await expect(page.getByText(`${type} venue updated`)).not.toBeVisible();

      await page.goto(`/events/${event.id}/timeline`);
      await expect(page.getByRole('heading', { name: /timeline workspace/i })).toBeVisible();
      await page.getByLabel(/task or milestone/i).fill(`${type} milestone`);
      await page.getByRole('button', { name: /add milestone/i }).click();
      await expect(page.getByText(`${type} milestone`)).toBeVisible();
      await page.getByRole('button', { name: /milestone list/i }).click();
      await page.getByRole('button', { name: `Edit ${type} milestone` }).click();
      await page.getByLabel(/task or milestone/i).fill(`${type} milestone updated`);
      await page.getByRole('button', { name: /save changes/i }).click();
      await expect(page.getByText(`${type} milestone updated`)).toBeVisible();
      await page.getByRole('button', { name: `Delete ${type} milestone updated` }).click();
      await expect(page.getByText(`${type} milestone updated`)).not.toBeVisible();

      await page.goto(`/events/${event.id}/vendors`);
      await expect(page.getByRole('heading', { name: /vendor checklist/i })).toBeVisible();
      await page.getByLabel('Category').fill('Venue');
      await page.getByLabel('Vendor name').fill(`${type} venue vendor`);
      await page.getByRole('button', { name: /add vendor/i }).click();
      await expect(page.getByText(`${type} venue vendor`)).toBeVisible();
      await page.getByRole('button', { name: `Edit ${type} venue vendor` }).click();
      await page.getByLabel('Vendor name').fill(`${type} venue vendor updated`);
      await page.getByRole('button', { name: /save changes/i }).click();
      await expect(page.getByText(`${type} venue vendor updated`)).toBeVisible();
      await page.getByRole('button', { name: `Delete ${type} venue vendor updated` }).click();
      await expect(page.getByText(`${type} venue vendor updated`)).not.toBeVisible();

      await page.goto(`/events/${event.id}/ideas`);
      await expect(page.getByRole('heading', { name: /personalized ideas/i })).toBeVisible();

      await page.goto(`/events/${event.id}/assistant`);
      await expect(page.getByRole('heading', { name: new RegExp(`${event.title}.*AI Copilot`, 'i') })).toBeVisible();

      const persisted = await page.request.get(`/api/events/${event.id}/budget`);
      expect((await persisted.json()).some((item: { name: string }) => item.name === `${type} venue updated`)).toBe(false);
      await page.request.delete(`/api/events/${event.id}`);
    }
  });
});
