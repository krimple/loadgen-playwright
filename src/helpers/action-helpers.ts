import { Span, SpanStatusCode, trace } from "@opentelemetry/api";
import { BASE_URL } from "../configuration";
import {
  Browser,
  BrowserContext,
  BrowserType,
  expect,
  Page, ViewportSize
} from "@playwright/test";
import { selectBrowser } from '../utils';

const tracer = trace.getTracer("playwright");

const VIEWPORT_SIZES = [
  { width: 1024, height: 768 },
  { width: 1920, height: 1280 },
  { width: 3840, height: 2540 },
  { width: 800, height: 600 }
] as const;

export function getRandomViewportSize(): ViewportSize {
  const randomIndex = Math.floor(Math.random() * VIEWPORT_SIZES.length);
  return VIEWPORT_SIZES[randomIndex];
}

export async function getBrowserInstance(): Promise<{ browser: Browser, context: BrowserContext, page: Page } | undefined> {
  const browserType = selectBrowser().browser;
  return tracer.startActiveSpan('browser-instance', async (span) => {
    try {
      span.setAttribute("app.browser", browserType.name());
      const browser = await browserType.launch({headless: true, env: {}});
      const context = await browser.newContext();
      const page = await context.newPage();

      const viewportSize = getRandomViewportSize();
      await page.setViewportSize(viewportSize);
      span.setAttribute("app.viewport.size", `${viewportSize.width}x${viewportSize.height}`);
      recordBrowserCharacteristics(span, page, browser, browserType);
      return {browser, context, page};
    } catch (e) {
      reportError(e, span);
    } finally {
      span.end();
    }
  });
}

export async function releaseBrowserInstance(
  page: Page,
  context: BrowserContext,
  browser: Browser,
) {
  await context.close();
  await browser.close();
}

export function reportError(error: any, span?: Span) {
  const normalizedError =
      error instanceof Error ? error : new Error("Unknown error occurred");

  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: `${normalizedError.message}`,
    });
  } else {
    tracer.startActiveSpan('report-error', (span) => {
      span.recordException(normalizedError);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `${normalizedError.message}`,
      });
      span.end();
    })
  }
}

function getRandomDelay(baseMs: number) {
  const range = baseMs * 0.4;
  const min = baseMs - range;
  const max = baseMs + range;
  return Math.random() * (max - min) + min;
}

export async function randomTimeout(baseMs: number) {
  const delay = getRandomDelay(baseMs);
  // TODO span.setAttribute("app.timeout", delay);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function waitForMS(span: Span, delay: number) {
  span.setAttribute("app.timeout", delay);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function awaitOTLPRequest(page: Page, timeout = 5000) {
  try {
    await page.waitForLoadState("networkidle");
    const request = await page.waitForRequest(
      (req) =>
        req.url().includes('/v1/traces') &&
        req.method() === 'POST' &&
        (req.postData()?.includes('resourceSpans') ?? false),
      { timeout }
    );

    // console.log(JSON.stringify(JSON.parse(request.postData() || '{}'), null, 2));

    console.log('Observed OTLP trace export:', request.url());
  } catch {
    console.warn('No OTLP trace observed in time window.');
  }
}

export async function verifyLocation(
  page: Page,
  urlPattern: string | RegExp,
  timeout: number = 10000
): Promise<void> {
  return tracer.startActiveSpan('verify-navigation', async (span: Span) => {
    try {
      await page.waitForURL(urlPattern, {timeout});
      span.setAttribute('app.navigated.to', page.url());
    } catch (e) {
      reportError(e, span);
    } finally {
      span.end();
    }
  });
}

export function addMemoryInfoSpan() {
  const span = tracer.startSpan('script-memory-usage');

  const memInfo = process.memoryUsage();
  const availableMemory = process.availableMemory();
  const usedMemory = process.constrainedMemory();

  span.setAttribute("app.memory.rss", memInfo.rss);
  span.setAttribute("app.memory.external", memInfo.external);
  span.setAttribute("app.memory.arrayBuffers", memInfo.arrayBuffers);
  span.setAttribute("app.memory.heapTotal", memInfo.heapTotal);
  span.setAttribute("app.memory.heapUsed", memInfo.heapUsed);
  span.setAttribute("app.memory.available", availableMemory);
  span.setAttribute("app.memory.used", usedMemory);
  span.end();
}

export function addBrowserInfoSpan(browserType: BrowserType, viewPortSize?: {width: number, height: number}|undefined) {
  const span = tracer.startSpan('browser-info');
  span.setAttributes({ "app.browser": browserType.name() }); // INSTRUMENTATION: add relevant info
  if (viewPortSize) {
    span.setAttributes({"app.browser.viewport": JSON.stringify(viewPortSize)}); // INSTRUMENTATION: add relevant info
  }
  span.end();
}

const usStateSubset = ['PA', 'NJ', 'ID', 'NM', 'CO', 'CA', 'DE', 'OR', 'WA', 'MS', 'KA'];

// default to 'CA' if one not found
export function pickRandomUSState(): string {
  const idx = Math.floor(Math.random() * usStateSubset.length)
  if (idx) {
    return usStateSubset.at(idx) || 'CA';
  } else {
    return 'CA';
  }
}

export async function clickRandomSelectorElements(
  page: Page,
  selector: string, 
  clickCount: number,
): Promise<void> {
  return tracer.startActiveSpan('click-random', async (span: Span) => {
    try {
      span.setAttribute("app.selector", selector);
      const allButtonsLocator = page.locator(selector);
      const total = await allButtonsLocator.count();
      span.setAttribute("app.selector.count", total);

      if (total < clickCount) {
        throw new Error(`Only found ${total} elements matching "${selector}", needed ${clickCount}`);
      }
      // Create a shuffled array of unique indices
      const indices = Array.from({length: total}, (_, i) => i)
          .sort(() => 0.5 - Math.random())
          .slice(0, clickCount);
      for (const i of indices) {
        const button = allButtonsLocator.nth(i);
        console.log('clicking on', i);
        await Promise.all([
          button.click(),
          page.waitForResponse(new RegExp(`/api/cart/items/(\\d+)$`))
        ]);
      }
    } catch (e) {
      reportError(e, span);
    } finally {
      span.end();
    }
  });
}

export async function clickSelector(
  page: Page,
  selector: string,
  targetName: string
): Promise<void> {
  return tracer.startActiveSpan('click', async (span: Span) => {
    try {
      await page.click(selector);
      span.setAttribute("app.selector", selector);
      span.setAttribute("app.target", targetName);
    } catch (e) {
      reportError(e, span);
    } finally {
      span.end();
    }
  });
}

export function recordBrowserCharacteristics(
  span: Span, 
  page: Page, 
  browser: Browser, 
  browserType: BrowserType
): void {
  const viewportSize = page.viewportSize();

  if (!viewportSize) {
    throw new Error('no viewport size');
  }

  addMemoryInfoSpan();
  addBrowserInfoSpan(browserType, viewportSize);
  span.setAttributes({ "app.browser": browserType.name() }); // INSTRUMENTATION: add relevant info
}

export async function navigateToUrl(page: Page, url: string): Promise<void> {
  return tracer.startActiveSpan('navigate', async (span: Span) => {
    try {
      span.addEvent('navigating', { 'app.nav-url': url });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      span.setAttributes({ 'app.navigation.success': true });
    } catch (e) {
      reportError(e, span);
      throw e;
    } finally {
      span.end();
    }
  });
}
