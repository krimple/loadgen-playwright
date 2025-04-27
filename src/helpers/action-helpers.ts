import { Span, SpanStatusCode } from "@opentelemetry/api";
import { BASE_URL } from "../configuration";
import {
  Browser,
  BrowserContext,
  BrowserType,
  expect,
  Page,
} from "@playwright/test";

export async function getBrowserInstance(span: Span, browserType: BrowserType) {
  span.setAttribute("app.browser", browserType.name());
  const browser = await browserType.launch({ headless: true, env: { } });
  const context = await browser.newContext();
  const page = await context.newPage();
  return { browser, context, page };
}

export async function releaseBrowserInstance(
  page: Page,
  context: BrowserContext,
  browser: Browser,
) {
  await context.close();
  await browser.close();
}

export function reportError(error: any, span: Span) {
  const normalizedError =
    error instanceof Error ? error : new Error("Unknown error occurred");
  span.recordException(normalizedError);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: `${normalizedError.message}`,
  });
}

function getRandomDelay(baseMs: number) {
  const range = baseMs * 0.4;
  const min = baseMs - range;
  const max = baseMs + range;
  return Math.random() * (max - min) + min;
}

export async function randomTimeout(span: Span, baseMs: number) {
  const delay = getRandomDelay(baseMs);
  span.setAttribute("app.timeout", delay);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function waitForMS(span: Span, delay: number) {
  span.setAttribute("app.timeout", delay);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function awaitOTLPRequest(page: Page, timeout = 10000) {
  try {
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

export async function verifyNavigation(
  page: Page,
  span: Span,
  urlPattern: string | RegExp,
  timeout: number = 10000
): Promise<void> {
  await expect(page).toHaveURL(urlPattern, { timeout });
  span.addEvent('navigation-change', {
    'app.navigated.to': page.url()
  });
}

export function addMemoryInfoToSpan(span: Span) {
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
  span: Span,
  page: Page, 
  selector: string, 
  clickCount: number,
  afterClickDelayInterval: number = 5000
): Promise<void> {
  const allButtonsLocator = page.locator(selector);
  const total = await allButtonsLocator.count();

  if (total < clickCount) {
    throw new Error(`Only found ${total} elements matching "${selector}", needed ${clickCount}`);
  }

  // Create a shuffled array of unique indices
  const indices = Array.from({ length: total }, (_, i) => i)
    .sort(() => 0.5 - Math.random())
    .slice(0, clickCount);

  for (const i of indices) {
    const button = allButtonsLocator.nth(i);
    console.log('clicking on', i);
    await Promise.all([
      page.waitForLoadState('networkidle'),
      button.click()
    ]);
  }

  // delay after all clicks to let browser send OTLP
  // await waitForMS(span, afterClickDelayInterval);
}

export async function clickSelector(
  page: Page,
  span: Span,
  selector: string,
  logAsName: string
): Promise<void> {
  const button = page.locator(selector);
  await button.click();

  span.addEvent('clicked', {
    'app.clicked.event': logAsName
  });
}
