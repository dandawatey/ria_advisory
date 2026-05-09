import { test, expect } from '@playwright/test';

test.describe('Impersonation Console E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login as ria_admin — in real env, use Azure SSO
    // For now, assume session is authenticated
    await page.goto('/admin/impersonation-console');
    await page.waitForURL('**/admin/impersonation-console');
  });

  test('test_admin_impersonates_user', async ({ page }) => {
    // Wait for users table to load
    await page.waitForSelector('table');

    // Find a finance_user in the table
    const firstUserRow = page.locator('tbody tr:first-child');
    await expect(firstUserRow).toContainText('finance_user');

    // Click Impersonate button in first row
    const impersonateButtons = page.locator('button[aria-label*="Impersonate"]');
    await impersonateButtons.first().click();

    // Verify impersonate modal opens
    await expect(page.locator('text=Impersonate User')).toBeVisible();
    await expect(page.locator('text=This action will be logged')).toBeVisible();

    // Enter reason
    await page.fill('input[id="reason-input"]', 'Support ticket #1234');

    // Click Impersonate button in modal
    await page.click('button:has-text("Impersonate")');

    // Verify impersonation token stored (check sessionStorage)
    const token = await page.evaluate(() => sessionStorage.getItem('impersonation_token'));
    expect(token).toBeTruthy();

    // Verify modal closes
    await expect(page.locator('text=Impersonate User')).not.toBeVisible();
  });

  test('test_impersonation_audit_log', async ({ page }) => {
    // Wait for users table to load
    await page.waitForSelector('table');

    // Click Audit Log tab
    const auditTab = page.locator('button:has-text("Audit Log")');
    await auditTab.click();

    // Verify audit log table appears
    await page.waitForSelector('table');

    // Check table structure (headers)
    await expect(page.locator('text=Admin')).toBeVisible();
    await expect(page.locator('text=Target User')).toBeVisible();
    await expect(page.locator('text=Started')).toBeVisible();

    // Verify audit entries exist (if any)
    const auditRows = page.locator('tbody tr');
    const rowCount = await auditRows.count();

    // Either rows exist OR empty state message shown
    if (rowCount > 0) {
      expect(rowCount).toBeGreaterThan(0);
    } else {
      await expect(page.locator('text=No impersonation activity')).toBeVisible();
    }
  });
});
