import { test, expect } from '@playwright/test';

/**
 * CFO360 Real Product Demo
 *
 * This test records a comprehensive demo of CFO360 features:
 * 1. Login to RIA Admin
 * 2. Navigate Settings → Connectors
 * 3. Show Business Central connection
 * 4. Demonstrate key features (Dashboard, Reports, etc.)
 * 5. Narration explains each section
 */

const BASE_URL = 'http://localhost:5002';

// Helper: Wait for narration pause (video shows static frame for voice-over)
async function narratePause(page, seconds = 3) {
  console.log(`[NARRATION PAUSE] ${seconds}s for voice-over`);
  await page.waitForTimeout(seconds * 1000);
}

// Helper: Slow scroll for visibility
async function scrollSlow(page, distance = 500) {
  await page.evaluate((dist) => {
    window.scrollBy({ top: dist, behavior: 'smooth' });
  }, distance);
  await page.waitForTimeout(1500);
}

test.describe('CFO360 Product Demo', () => {
  test.setTimeout(300000); // 5 min timeout

  test('Complete CFO360 Feature Demo with Narration', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log('=== CFO360 DEMO VIDEO START ===\n');

    // ===== INTRO =====
    console.log('[0:00] INTRO - Navigate to CFO360');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await narratePause(page, 4);
    console.log('[NARRATE] Welcome to CFO360 - CFO Intelligence Platform\n');

    // ===== LOGIN SECTION =====
    console.log('[0:05] LOGIN - Show login page');
    try {
      // Check if already logged in, if not show login flow
      const loginButton = await page.locator('button:has-text("Login")').first();
      if (await loginButton.isVisible({ timeout: 2000 })) {
        console.log('[ACTION] Click login button');
        await loginButton.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('[INFO] Already logged in or login not visible');
    }

    // Navigate to dashboard
    console.log('[0:10] Navigate to Dashboard');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await narratePause(page, 5);
    console.log('[NARRATE] Here is the CFO360 Dashboard - Executive Summary with Key Metrics\n');

    // Screenshot dashboard
    await page.screenshot({ path: '/tmp/cfo360-dashboard.png' });
    console.log('[SCREENSHOT] Dashboard captured');

    // Scroll to show KPI cards
    await scrollSlow(page, 300);
    await narratePause(page, 3);
    console.log('[NARRATE] Showing KPI Cards - Revenue, Margin, Cash Flow metrics updated in real-time\n');

    // ===== CONNECTORS SECTION =====
    console.log('[0:30] CONNECTORS - Navigate to Settings');
    try {
      // Look for Settings navigation
      await page.click('text=/Settings|settings/i', { timeout: 3000 }).catch(() => {
        console.log('[INFO] Settings not found via text click');
      });
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('[INFO] Settings navigation attempted');
    }

    // Navigate directly to connectors page
    await page.goto(`${BASE_URL}/settings/connectors`, { waitUntil: 'domcontentloaded' }).catch(async () => {
      // Fallback - navigate from dashboard
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    });

    await page.waitForLoadState('networkidle');
    await narratePause(page, 3);
    console.log('[NARRATE] CFO360 Connector Management - Connect to any ERP System\n');

    // Take connector screenshot
    await page.screenshot({ path: '/tmp/cfo360-connectors.png' });
    console.log('[SCREENSHOT] Connectors page captured');

    // Scroll to show available connectors
    await scrollSlow(page, 400);
    await narratePause(page, 4);
    console.log('[NARRATE] Supported ERP Systems: SAP S/4HANA, Business Central, Oracle NetSuite, and more\n');

    // ===== BUSINESS CENTRAL CONNECTION =====
    console.log('[1:00] BC CONNECTION - Show Business Central Setup');
    try {
      // Look for BC connector
      await page.click('text=/Business Central|BC|Dynamics/i', { timeout: 3000 }).catch(() => {
        console.log('[INFO] BC connector not found');
      });
      await page.waitForTimeout(1500);
      await narratePause(page, 5);
      console.log('[NARRATE] Business Central Integration - One-click setup with OAuth2 authentication\n');
    } catch (e) {
      console.log('[INFO] BC connection section skipped');
    }

    // ===== REPORTING FEATURES =====
    console.log('[1:15] REPORTING - Navigate to Reports');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Look for reports or P&L button
    try {
      await page.click('text=/P&L|Report|Consolidated/i', { timeout: 3000 }).catch(() => {
        console.log('[INFO] Report button not found');
      });
      await page.waitForTimeout(1500);
    } catch (e) {
      console.log('[INFO] Report navigation attempted');
    }

    await narratePause(page, 4);
    console.log('[NARRATE] Financial Reports - Consolidated P&L across all entities in real-time\n');

    // Take report screenshot
    await page.screenshot({ path: '/tmp/cfo360-reports.png' });
    console.log('[SCREENSHOT] Reports page captured');

    // ===== RECONCILIATION =====
    console.log('[1:45] RECONCILIATION - Show Reconciliation Feature');
    try {
      await page.click('text=/Reconciliation|Recon/i', { timeout: 3000 }).catch(() => {
        console.log('[INFO] Reconciliation not found');
      });
      await page.waitForTimeout(1500);
      await narratePause(page, 4);
      console.log('[NARRATE] Automated Reconciliation - ML-powered matching with audit trail\n');
    } catch (e) {
      console.log('[INFO] Reconciliation section skipped');
    }

    // ===== DATA FRESHNESS =====
    console.log('[2:15] FRESHNESS - Show Data Freshness Indicator');
    await narratePause(page, 3);
    console.log('[NARRATE] Real-time Data Freshness - Know exactly when your data was last synced\n');

    // ===== SECURITY & COMPLIANCE =====
    console.log('[2:30] SECURITY - Show Security Features');
    await narratePause(page, 3);
    console.log('[NARRATE] Enterprise Security - Multi-tenant isolation, SOX compliance, audit logging\n');

    // ===== SUMMARY =====
    console.log('[2:45] SUMMARY - Back to Dashboard');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await narratePause(page, 5);
    console.log('[NARRATE] CFO360 - The Modern CFO Intelligence Platform. Transform your financial reporting.\n');

    console.log('=== CFO360 DEMO VIDEO COMPLETE ===');
  });
});
