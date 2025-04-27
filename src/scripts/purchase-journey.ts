import {BrowserType, expect} from '@playwright/test';
import { trace, Span } from '@opentelemetry/api';
import {
  awaitOTLPRequest,
  randomTimeout,
  getBrowserInstance,
  releaseBrowserInstance,
  reportError,
  addMemoryInfoToSpan,
  clickRandomSelectorElements,
  clickSelector,
  pickRandomUSState,
  verifyNavigation
} from "../helpers/action-helpers";
import {selectBrowser} from "../utils";

const tracer = trace.getTracer("playwright");

// TODO - get rid of "i'm here" step console logs when I know this is rock solid
export async function run(BASE_URL: string, delayFactor: number) {
  const browserType = selectBrowser().browser;

  return new Promise<void>(async (resolve, reject) => {
    return tracer.startActiveSpan('purchase-journey', async (span: Span): Promise<void> => {
      const {browser, context, page} = await getBrowserInstance(span, browserType);
      addMemoryInfoToSpan(span);
      span.setAttributes({ "app.browser": browserType.name() }); // INSTRUMENTATION: add relevant info
      try {
        span.addEvent('navigating', { 'app.nav-url': BASE_URL });

        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

        // Wait for telemetry request
        await awaitOTLPRequest(page);

        // Ensure we are on the root page
        await verifyNavigation(page, span, `${BASE_URL}/`);

        // Wait for telemetry request
        span.addEvent('verified', {
          'app.navigating.confirmation': true
        });

        const shoppingButton = page.locator('//a[text()="Shop Now"]');
        await shoppingButton.click();

        await awaitOTLPRequest(page);

        span.addEvent('clicked', {
          'app.clicked.event': 'Shop Now'
        });

        // Confirm redirect to product page
        await expect(page).toHaveURL(/\/products/);
        span.addEvent('navigation-change', {
          'app.navigated.to': page.url()
        });

        // pick random products
        await clickRandomSelectorElements(span, page, 'button:has-text("Add to Cart"):not(:disabled)', 1)

        // wait for 0-5 seconds
        await randomTimeout(span, 5000);

        // go to shopping cart
        await clickSelector(page, span, '//a[text()="Cart"]', 'shopping cart');

        // make sure we landed on the cart page
        await verifyNavigation(page, span, /\/cart/);

        // // pick a random US State and fill it
        // const usState = pickRandomUSState();
        // await page.fill("input#state", usState);

        // go to checkout
        await clickSelector(page, span, '//button[text="Place Order"]', 'place order');

        // I think the page does some gyrations, adding pause
        // await randomTimeout(span, delayFactor);

        // // isn't getting the checkout url change...

        // // wait until we get an orderId on the URL
        await verifyNavigation(page, span, /\?order/);
        await page.waitForURL(/\?order/);

        // // Final telemetry request (ignore errors)
        try {
          await awaitOTLPRequest(page, 6000);
        } catch (e) {
          page.screenshot({ 
            path:'screenshots/failure.png',
            fullPage: true,
          });
          console.error(e);
          // console.warn('Telemetry request failed, continuing...');
        }

        console.log('Purchase journey completed successfully');

        await randomTimeout(span, delayFactor);

        resolve();
      } catch (error) {
        reportError(error, span);
        reject(error);
      } finally {
        span.end();
        await releaseBrowserInstance(page, context, browser);
      }
    });
  });
}
