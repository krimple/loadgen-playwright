const { expect } = require('@playwright/test');
const { selectBrowser } = require("../utils");
const { readFileSync } = require('fs');

const BASE_URL = 'http://localhost:9191';

(async () => {
  for (let i = 0; i < 10; i++) {
    const browserName = selectBrowser().name;
    const browserType = selectBrowser().browser;
    console.log(`Iteration ${i + 1} with ${browserName}`);
    await executeScript(browserType);
  }
})();

async function executeScript(browserType) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
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

    // one more for the road? Ignore if fails
    try {
      await page.waitForRequest(`${BASE_URL}/otlp-http/v1/traces`);
    } catch (e) {

    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await page.close();
    await context.close();
  }
}
