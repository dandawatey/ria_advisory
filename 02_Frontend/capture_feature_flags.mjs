import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:5002/login', {
      waitUntil: 'networkidle',
      timeout: 15000
    });

    console.log('Clicking Email & Password tab...');
    const emailTabBtn = page.locator('button:has-text("Email & Password")');
    await emailTabBtn.click();
    console.log('Email tab clicked');

    // Wait for email input to appear
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    console.log('Email input appeared');

    // Fill email and password
    console.log('Filling login credentials...');
    await page.fill('input[type="email"]', 'admin@ria-advisory.com');
    await page.fill('input[type="password"]', 'Admin@2026');
    console.log('Credentials filled');

    // Click Sign in button
    console.log('Clicking Sign in...');
    const signInBtn = page.locator('button:has-text("Sign in")');
    await signInBtn.click();

    // Wait for redirect to admin page
    console.log('Waiting for admin dashboard...');
    await page.waitForURL('**/admin/**', { timeout: 10000 });

    // Navigate to feature flags page
    console.log('Navigating to Feature Flags page...');
    await page.goto('http://localhost:5002/admin/feature-flags', {
      waitUntil: 'networkidle',
      timeout: 15000
    });

    // Wait for content to render
    await page.waitForSelector('input, button, table', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // Take screenshot
    const screenshotPath = '/tmp/cfo360-feature-flags.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(`✓ Screenshot captured: ${screenshotPath}`);
    console.log(`Final URL: ${page.url()}`);

  } catch (error) {
    console.log(`Error: ${error.message}`);
    const screenshotPath = '/tmp/cfo360-feature-flags-error.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Error screenshot: ${screenshotPath}`);
  } finally {
    await browser.close();
  }
})();
