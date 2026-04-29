export { contentHash, discoverLinks, cleanText, truncateToWords } from './shared';
export type { DiscoveredLinks } from './shared';

export type { IBrowserManager } from './browser';
export { PlaywrightBrowserManager, MockBrowserManager } from './browser';

export type { IPageRepository } from './page-repository';
export { PageRepository, MockPageRepository } from './page-repository';

export {
  Scraper,
  homepageStrategy,
  careersStrategy,
  loginStrategy,
  type ScraperResult,
  type ScraperStrategy,
} from './scraper';

export { HomepageScraper } from './homepage';
export { CareersScraper } from './careers';
export { LoginScraper } from './login';
