import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, results.violations.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
}

test.describe('browser accessibility', () => {
  async function createEvent(page: Page) {
    const response = await page.request.post('/api/events', {
      data: {
        type: 'community',
        title: `Accessibility audit ${Date.now()}`,
        date: '2027-01-15T10:00:00.000Z',
        guest_count: 20,
        budget_amount: 25000,
        currency: 'USD',
      },
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).id as string;
  }

  test('landing page has no automated accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /your big moments deserve/i })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test('event wizard has no violations and supports keyboard activation', async ({ page }) => {
    await page.goto('/events/new');
    await expect(page.getByRole('heading', { name: /what are you planning/i })).toBeVisible();
    await expectNoAccessibilityViolations(page);

    const birthday = page.getByRole('button', { name: /birthday/i });
    await birthday.focus();
    await page.keyboard.press('Enter');
    await expect(birthday).toHaveAttribute('aria-pressed', 'true');

    const continueButton = page.getByRole('button', { name: /continue/i });
    await continueButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: /set the essentials/i })).toBeVisible();
  });

  test('all primary routes pass axe at a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const eventId = await createEvent(page);
    const routes = [
      '/',
      '/dashboard',
      '/events/new',
      `/events/${eventId}`,
      `/events/${eventId}/budget`,
      `/events/${eventId}/timeline`,
      `/events/${eventId}/vendors`,
      `/events/${eventId}/ideas`,
      `/events/${eventId}/assistant`,
    ];

    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForTimeout(100);
      await expectNoAccessibilityViolations(page);
    }

    await page.request.delete(`/api/events/${eventId}`);
  });
});
