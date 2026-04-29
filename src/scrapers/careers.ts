import type { IBrowserManager } from './browser';
import type { IPageRepository } from './page-repository';
import { Scraper, careersStrategy, type ScraperResult } from './scraper';

export type { ScraperResult };

export class CareersScraper {
  private readonly inner: Scraper;
  constructor(browser: IBrowserManager, pageRepo: IPageRepository) {
    this.inner = new Scraper(browser, pageRepo, careersStrategy);
  }
  scrape(companyId: string, url: string): Promise<ScraperResult> {
    return this.inner.scrape(companyId, url);
  }
}
