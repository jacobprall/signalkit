import type { Browser } from 'playwright';
import { cleanText } from './shared';

export interface IBrowserManager {
  extractText(url: string): Promise<string>;
  extractTextAndLinks(url: string): Promise<{ text: string; hrefs: string[] }>;
  close(): Promise<void>;
}

export interface PlaywrightBrowserOptions {
  navigationTimeoutMs?: number;
  networkIdleTimeoutMs?: number;
}

const DEFAULT_NAV_TIMEOUT_MS = 30_000;
const DEFAULT_IDLE_TIMEOUT_MS = 10_000;

export class PlaywrightBrowserManager implements IBrowserManager {
  private browser: Browser | null = null;

  constructor(private readonly options: PlaywrightBrowserOptions = {}) {}

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      const { chromium } = await import('playwright');
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  async extractText(url: string): Promise<string> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto(url, {
        timeout: this.options.navigationTimeoutMs ?? DEFAULT_NAV_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      });
      await page
        .waitForLoadState('networkidle', {
          timeout: this.options.networkIdleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
        })
        .catch(() => {});
      const raw = await page.evaluate(() => document.body.innerText);
      return cleanText(raw);
    } finally {
      await page.close();
    }
  }

  async extractTextAndLinks(
    url: string,
  ): Promise<{ text: string; hrefs: string[] }> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.goto(url, {
        timeout: this.options.navigationTimeoutMs ?? DEFAULT_NAV_TIMEOUT_MS,
        waitUntil: 'domcontentloaded',
      });
      await page
        .waitForLoadState('networkidle', {
          timeout: this.options.networkIdleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS,
        })
        .catch(() => {});

      const [raw, hrefs] = await Promise.all([
        page.evaluate(() => document.body.innerText),
        page.evaluate(() =>
          Array.from(document.querySelectorAll('a[href]')).map(
            (a) => (a as HTMLAnchorElement).href,
          ),
        ),
      ]);

      return { text: cleanText(raw), hrefs };
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export class MockBrowserManager implements IBrowserManager {
  private pages: Map<string, { text: string; hrefs: string[] }> = new Map();

  setPage(url: string, text: string, hrefs: string[] = []): void {
    this.pages.set(url, { text, hrefs: [...hrefs] });
  }

  async extractText(url: string): Promise<string> {
    const page = this.pages.get(url);
    if (!page) throw new Error(`No mock page for ${url}`);
    return page.text;
  }

  async extractTextAndLinks(
    url: string,
  ): Promise<{ text: string; hrefs: string[] }> {
    const page = this.pages.get(url);
    if (!page) throw new Error(`No mock page for ${url}`);
    // Return a defensive copy so callers can't mutate the stored state.
    return { text: page.text, hrefs: [...page.hrefs] };
  }

  async close(): Promise<void> {}
}
