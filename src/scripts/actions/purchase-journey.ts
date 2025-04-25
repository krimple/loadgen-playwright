import {BrowserType, expect} from '@playwright/test';
import { trace, Span } from '@opentelemetry/api';
import {
  awaitOTLPRequest,
  randomTimeout,
  getBrowserInstance,
  releaseBrowserInstance,
  reportError,
  verifyUrlPattern,
  addMemoryInfoToSpan, pickRandomUSState
} from "../action-helpers";
import {selectBrowser} from "../../utils";

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
        verifyUrlPattern(page, span, `${BASE_URL}/`);

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

        // pick 4 random products

        const allButtonsLocator = page.locator('button:has-text("Add to Cart"):not(:disabled)');
        const total = await allButtonsLocator.count();
      
        if (total < 4) {
          throw new Error(`Only found ${total} enabled Add to Cart buttons`);
        }
      
        // Create a shuffled array of unique indices
        const indices = Array.from({ length: total }, (_, i) => i)
          .sort(() => 0.5 - Math.random())
          .slice(0, 4);
       
        for (const i of indices) {
          const button = allButtonsLocator.nth(i);
          console.log('clicking on', i);
          await Promise.all([
            page.waitForLoadState('networkidle'), // or waitForResponse / waitForSelector
            button.click()
          ]);
        }

        await awaitOTLPRequest(page)

        const addToCartLocator= page.locator('//a[text()="Cart"]');
        await addToCartLocator.click();

        await awaitOTLPRequest(page)

        // Confirm redirect to product page
        await expect(page).toHaveURL(/\/cart/);
        span.addEvent('navigation-change', {
          'app.navigated.to': page.url()
        });

        // // pick a random US State and fill it
        // const usState = pickRandomUSState();
        // await page.fill("input#state", usState);

        // // checkout
        // const placeOrderLocator= page.locator("button[data-cy=\'checkout-place-order\']");
        // await placeOrderLocator.click();

        // console.log('14', placeOrderLocator, page.url())

        // // I think the page does some gyrations, adding pause
        // await randomTimeout(span, delayFactor);

        // console.log('15', page.url())

        // // isn't getting the checkout url change...

        // // wait until we get an orderId on the URL
        // await page.waitForURL(/\?order/);

        // console.log('16', page.url())

        // // nope, not complete yet
        // span.addEvent('checkout-complete', {
        //   'app.order.hash': page.url()
        // });

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
