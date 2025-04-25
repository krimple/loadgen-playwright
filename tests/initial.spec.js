const { test, expect } = require('@playwright/test');

// const BASE_URL = 'https://www.zurelia.honeydemo.io';
const BASE_URL = 'http://localhost:9191';

test.describe.configure({ mode: 'parallel' }); // Simulates concurrent execution

test('load root and navigate to shopping page', async ({ page }) => {
  // await page.evaluate(() => {
  //   window.__fetchRequests = [];
  //   const originalFetch = window.fetch;
  //   window.fetch = function (...args) {
  //     window.__fetchRequests.push(args[0]); // Track the URL
  //     return originalFetch.apply(this, args);
  //   };
  // });
  // Visit the root page
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // wait for telemetry send
  await page.waitForRequest(`${BASE_URL}/otlp-http/v1/traces`);

  // Check if root page loaded
  expect(page.url()).toBe(`${BASE_URL}/`);

  // Click the "Go Shopping" button
  const shoppingButton = page.locator('//button[text()="Go Shopping"]');
  await shoppingButton.click();

  // wait for telemetry send
  await page.waitForRequest(`${BASE_URL}/otlp-http/v1/traces`);

  // did we get hot products?
  await page.waitForFunction(() => window.location.hash === '#hot-products');

  // this is horrid
  const shoppingItem = page.locator('//*[@id="__next"]/main/div/div[2]/div/div/div/div/a[2]/div/div[1]');

  await shoppingItem.click();

  // wait for telemetry send
  await page.waitForRequest(`${BASE_URL}/otlp-http/v1/traces`);

  await expect(page).toHaveURL(/\/product\//);
  // TODO - maybe wait for an image to load?

  // last await?
  // wait for telemetry send
  //  await page.waitForRequest(`${BASE_URL}/otlp-http/v1/traces`, {
  //   timeout: 4000,
  //   required: false
  // });
});
