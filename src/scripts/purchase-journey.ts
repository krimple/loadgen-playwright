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
  verifyLocation, addBrowserInfoSpan, recordBrowserCharacteristics, navigateToUrl, waitForMS
} from "../helpers/action-helpers";
import {selectBrowser} from "../utils";

const tracer = trace.getTracer("playwright");

// TODO - get rid of "i'm here" step console logs when I know this is rock solid
export async function run(BASE_URL: string, delayFactor: number) {
  return tracer.startActiveSpan('purchase-journey', async (span: Span) => {

    return new Promise<void>(async (resolve, reject) => {
      const browserInfo = await getBrowserInstance();
      if (!browserInfo) {
        return reject('no browser');
      }

      const {browser, context, page} = browserInfo;

      try {
        // stagger scripts: wait for a little
        await randomTimeout(500);

        await navigateToUrl(page, BASE_URL);

        await page.waitForLoadState();

        const shoppingButton = page.locator('//a[text()="Shop Now"]');

        await shoppingButton.click();

        // Confirm redirect to product page
        await verifyLocation(page, /\/products/);

        await waitForMS(span, 500);

        // pick random products
        await clickRandomSelectorElements(page, 'button:has-text("Add to Cart"):not(:disabled)', 4)

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

        // if you want to pause while running the script, run one thread, set the headless property to false,
        // and place this strategically. It runs the debugger and lets you review things at the pause point
        // await page.pause();

        // place order with default fields
        await clickSelector(page, 'button:has-text("Place Order")', 'place-order');

        // I think the page does some gyrations, adding pause
        await randomTimeout(delayFactor);

        // // wait until we get an orderId on the URL
        await verifyLocation(page, /\//);

        // // Final telemetry request (ignore errors)
        try {
          await awaitOTLPRequest(page, 6000);
        } catch (e) {
          await page.screenshot({
            path: 'screenshots/failure.png',
            fullPage: true,
          });
          console.error(e);
          // console.warn('Telemetry request failed, continuing...');
        }

        console.log('Purchase journey completed successfully');

        // await randomTimeout(delayFactor);

        resolve();
      } catch (error) {
        reportError(error);
        reject(error);
      } finally {
        await releaseBrowserInstance(page, context, browser);
        span.end();
      }
    });
  });
}
