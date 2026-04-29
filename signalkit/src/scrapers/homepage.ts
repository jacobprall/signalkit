import type { IBrowserManager } from './browser';
import type { IPageRepository } from './page-repository';
import { Scraper, homepageStrategy, type ScraperResult } from './scraper';

export type { ScraperResult };

// Thin shim around the unified Scraper class. Kept so existing call sites
// (tests, API routes) don't need to change construction.
export class HomepageScraper {
  private readonly inner: Scraper;
  constructor(browser: IBrowserManager, pageRepo: IPageRepository) {
    this.inner = new Scraper(browser, pageRepo, homepageStrategy);
  }
  scrape(companyId: string, url: string): Promise<ScraperResult> {
    return this.inner.scrape(companyId, url);
  }
}
