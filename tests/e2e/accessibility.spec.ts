import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, results.violations.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([]);
}

test.describe('browser accessibility', () => {
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
});
