const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to login page...');
  await page.goto('http://localhost:5002/');
  await page.waitForTimeout(1000);

  // Login as superadmin
  console.log('Logging in as superadmin...');
  await page.fill('input[type="email"]', 'admin@ria-advisory.com');
  await page.fill('input[type="password"]', 'Admin@2026');
  await page.click('button:has-text("Sign In")');

  // Wait for redirect and navigation
  await page.waitForTimeout(2000);
  await page.waitForNavigation({ waitUntil: 'networkidle' });

  console.log('Navigating to Feature Flags page...');
  await page.goto('http://localhost:5002/admin/feature-flags');
  await page.waitForTimeout(2000);

  // Take screenshot
  const screenshotPath = '/tmp/cfo360-feature-flags.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });

  console.log(`✓ Screenshot saved: ${screenshotPath}`);
  console.log(`URL: http://localhost:5002/admin/feature-flags`);
  console.log(`User: superadmin (admin@ria-advisory.com)`);

  await browser.close();
})();
