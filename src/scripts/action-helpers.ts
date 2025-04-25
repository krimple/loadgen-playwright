import { Span, SpanStatusCode } from "@opentelemetry/api";
import { BASE_URL } from "./configuration";
import {
  Browser,
  BrowserContext,
  BrowserType,
  expect,
  Page,
} from "@playwright/test";

export async function getBrowserInstance(span: Span, browserType: BrowserType) {
  span.setAttribute("app.browser", browserType.name());
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  return { browser, context, page };
}

export async function releaseBrowserInstance(
  page: Page,
  context: BrowserContext,
  browser: Browser,
) {
  await page.close();
  await context.close();
  await browser.close();
}

export function reportError(error: any, span: Span) {
  const normalizedError =
    error instanceof Error ? error : new Error("Unknown error occurred");
  span.recordException(normalizedError);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: `Failed purchase: ${normalizedError.message}`,
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

export async function awaitOTLPRequest(page: Page, timeout = 10000) {
  try {
    const request = await page.waitForRequest(
      (req) =>
        req.url().includes('/v1/traces') &&
        req.method() === 'POST' &&
        (req.postData()?.includes('resourceSpans') ?? false),
      { timeout }
    );

    console.log('Observed OTLP trace export:', request.url());
  } catch {
    console.warn('No OTLP trace observed in time window.');
  }
}

export function verifyUrlPattern(page: Page, span: any, pattern: string) {
  // Ensure we are on the root page
  expect(page.url()).toBe(pattern);
  span.addEvent("verified", {
    "app.navigating.confirmation": true,
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
