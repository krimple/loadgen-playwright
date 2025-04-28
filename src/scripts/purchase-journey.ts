import {BrowserType, expect} from '@playwright/test';
import { trace, Span } from '@opentelemetry/api';
import {
  awaitOTLPRequest,
  randomTimeout,
  getBrowserInstance,
  releaseBrowserInstance,
  reportError,
  addMemoryInfoSpan,
  clickRandomSelectorElements,
  clickSelector,
  pickRandomUSState,
  verifyLocation, addBrowserInfoSpan
} from "../helpers/action-helpers";
import {selectBrowser} from "../utils";

const tracer = trace.getTracer("playwright");

// TODO - get rid of "i'm here" step console logs when I know this is rock solid
export async function run(BASE_URL: string, delayFactor: number) {
  const browserType = selectBrowser().browser;

  return new Promise<void>(async (resolve, reject) => {
    return tracer.startActiveSpan('purchase-journey', async (span: Span): Promise<void> => {
      const {browser, context, page} = await getBrowserInstance(span, browserType);
      if (!page || !browser || !context) {
        return reject('no browser');
      }

      const viewportSize = page.viewportSize();

      if (!viewportSize) {
        return reject('no viewport size');
      }

      addMemoryInfoSpan();

      addBrowserInfoSpan(browserType, viewportSize);

      span.setAttributes({ "app.browser": browserType.name() }); // INSTRUMENTATION: add relevant info
      try {
        // stagger scripts:  wait for 0-10 seconds
        await randomTimeout(span, 10000);

        span.addEvent('navigating', { 'app.nav-url': BASE_URL });

        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

        // Wait for telemetry request
        await awaitOTLPRequest(page,2000);

        // Ensure we are on the root page
        await verifyLocation(page, `${BASE_URL}/`);

        const shoppingButton = page.locator('//a[text()="Shop Now"]');
        await shoppingButton.click();

        await awaitOTLPRequest(page);

        span.addEvent('clicked', {
          'app.clicked.event': 'Shop Now'
        });

        // Confirm redirect to product page
        await verifyLocation(page, /\/products/);

        // pick random products
        await clickRandomSelectorElements(page, 'button:has-text("Add to Cart"):not(:disabled)', 4)

        // wait for up to .5 seconds
        await randomTimeout(span, 500);

        // go to shopping cart
        // await clickSelector(page, '//a[text()="Cart"]', 'shopping-cart');
        await clickSelector(page, 'a:has-text("Cart")', 'shopping-cart');

        // make sure we landed on the cart page
        await verifyLocation(page, /\/cart/);

        // // pick a random US State and fill it
        // const usState = pickRandomUSState();
        // await page.fill("input#state", usState);

        // go to checkout
        await clickSelector(page, 'a:has-text("Proceed to Checkout")', 'place-order');

        // place order with default fields
        await clickSelector(page, 'button:has-text("Place Order")', 'place-order');

        // I think the page does some gyrations, adding pause
        // await randomTimeout(span, delayFactor);

        // // isn't getting the checkout url change...

        // // wait until we get an orderId on the URL
        await verifyLocation(page, /\//);
        await page.waitForURL(/\//);

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
