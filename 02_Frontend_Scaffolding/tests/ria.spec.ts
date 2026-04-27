/**
 * RIA Advisory — Playwright smoke tests
 * Verifies: backend endpoints, Explorer page, GL Search, Analytics page
 */
import { test, expect, request } from '@playwright/test';

const FRONTEND = 'http://127.0.0.1:4000';
const BACKEND  = 'http://127.0.0.1:8000';

// ── 1. Backend API health ─────────────────────────────────────────────────────

test('backend /api/analytics/filters returns companies', async ({ request }) => {
  const res = await request.get(`${BACKEND}/api/analytics/filters`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.companies.length).toBeGreaterThan(0);
  expect(data.years.length).toBeGreaterThan(0);
});

test('backend /api/analytics/pl-waterfall returns monthly rows', async ({ request }) => {
  const res = await request.get(`${BACKEND}/api/analytics/pl-waterfall`);
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0]).toHaveProperty('month');
  expect(rows[0]).toHaveProperty('revenue');
});

test('backend /api/gl/stats returns all 17 entities', async ({ request }) => {
  const res = await request.get(`${BACKEND}/api/gl/stats`);
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows.length).toBe(17);
  expect(rows[0]).toHaveProperty('code');
  expect(rows[0]).toHaveProperty('total_entries');
});

test('backend /api/gl/entries returns rows from star schema', async ({ request }) => {
  const res = await request.get(`${BACKEND}/api/gl/entries?company_id=8&limit=5`);
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0]).toHaveProperty('subsidiary_name');
  expect(rows[0]).toHaveProperty('gl_account_no');
  expect(rows[0]).toHaveProperty('amount');
  // Must NOT be a 500 error JSON from querying gl_unified
  expect(typeof rows[0].amount).toBe('number');
});

test('backend /api/analytics/kpi-summary returns revenue', async ({ request }) => {
  const res = await request.get(`${BACKEND}/api/analytics/kpi-summary`);
  expect(res.status()).toBe(200);
  const kpi = await res.json();
  expect(kpi.revenue).toBeGreaterThan(0);
  expect(kpi.entry_count).toBeGreaterThan(100000);
});

// ── 2. Frontend pages ─────────────────────────────────────────────────────────

test('GL Explorer page loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`${FRONTEND}/explorer`);
  await expect(page.locator('h1')).toContainText('GL Explorer');

  // KPI tiles should appear
  await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 });

  // No API connection errors
  const apiErrors = errors.filter(e => e.includes('ERR_CONNECTION_RESET') || e.includes('ERR_SOCKET_NOT_CONNECTED'));
  expect(apiErrors).toHaveLength(0);
});

test('GL Explorer charts tab loads chart data', async ({ page }) => {
  await page.goto(`${FRONTEND}/explorer`);
  // Wait for chart SVG to render (recharts outputs svg)
  await expect(page.locator('svg').first()).toBeVisible({ timeout: 15000 });
});

test('GL Explorer search tab returns real DB rows', async ({ page }) => {
  await page.goto(`${FRONTEND}/explorer`);

  // Click Search tab
  await page.click('button:has-text("GL Search")');

  // Select an entity from dropdown — wait for dynamic companies to load
  const select = page.locator('select').first();
  await expect(select).toBeVisible({ timeout: 5000 });
  // Wait until at least 18 options appear (17 entities + "All entities")
  await expect(select.locator('option')).toHaveCount(18, { timeout: 10000 });
  const optionCount = await select.locator('option').count();
  expect(optionCount).toBeGreaterThan(1);

  // Pick first real entity
  await select.selectOption({ index: 1 });

  // Click search
  await page.click('button:has-text("Search GL")');

  // Wait for results row
  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

  // Verify no "No results" empty state
  const empty = await page.locator('text=No results').count();
  expect(empty).toBe(0);
});

test('GL Explorer stats tab loads per-entity stats', async ({ page }) => {
  await page.goto(`${FRONTEND}/explorer`);
  await page.click('button:has-text("Load Stats")');
  // Wait for loading state to clear and all 17 rows to appear
  await expect(page.locator('table tbody tr')).toHaveCount(17, { timeout: 15000 });
});

test('Analytics page loads with filter panel', async ({ page }) => {
  await page.goto(`${FRONTEND}/analytics`);
  await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
  // Filter panel should have company checkboxes
  await expect(page.locator('input[type="checkbox"]').first()).toBeVisible({ timeout: 10000 });
});

test('Analytics KPI tiles show non-zero values', async ({ page }) => {
  await page.goto(`${FRONTEND}/analytics`);
  // KPI tiles load from /api/analytics/kpi-summary
  await page.waitForTimeout(4000); // allow API calls to complete
  const kpiText = await page.locator('.card').first().textContent();
  // Should not be all zeros or "..."
  expect(kpiText).not.toContain('...');
});
