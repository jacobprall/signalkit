import type { JobPayload } from '@/core/types';
import type { PageType } from '@/core/catalog';
import type { IBrowserManager } from './browser';
import type { IPageRepository } from './page-repository';
import { contentHash, discoverLinks } from './shared';

export interface ScraperResult {
  pageId: string;
  contentChanged: boolean;
  jobsToEnqueue: JobPayload[];
}

export interface ScraperStrategy {
  readonly pageType: PageType;
  /** Whether to extract anchor hrefs (true only for homepage today). */
  readonly discoverLinks: boolean;
  /** Hook that produces follow-up jobs only when the content changed. */
  onContentChange(args: {
    companyId: string;
    url: string;
    discovered?: { careersUrl: string | null; loginUrl: string | null };
  }): JobPayload[];
}

export class Scraper {
  constructor(
    private readonly browser: IBrowserManager,
    private readonly pageRepo: IPageRepository,
    private readonly strategy: ScraperStrategy,
  ) {}

  async scrape(companyId: string, url: string): Promise<ScraperResult> {
    const { text, hrefs } = this.strategy.discoverLinks
      ? await this.browser.extractTextAndLinks(url)
      : await this.browser
          .extractText(url)
          .then((t) => ({ text: t, hrefs: [] as string[] }));

    const hash = contentHash(text);

    const { contentChanged, pageId } = await this.pageRepo.upsert({
      companyId,
      url,
      pageType: this.strategy.pageType,
      contentText: text,
      contentHash: hash,
      scrapedAt: new Date(),
    });

    const jobsToEnqueue: JobPayload[] = [];
    if (contentChanged) {
      const discovered = this.strategy.discoverLinks
        ? discoverLinks(url, hrefs)
        : undefined;
      jobsToEnqueue.push(
        ...this.strategy.onContentChange({ companyId, url, discovered }),
      );
    }

    return { pageId, contentChanged, jobsToEnqueue };
  }
}

// ---------------------------------------------------------------------------
// Built-in strategies
// ---------------------------------------------------------------------------

export const homepageStrategy: ScraperStrategy = {
  pageType: 'homepage',
  discoverLinks: true,
  onContentChange({ companyId, discovered }) {
    const jobs: JobPayload[] = [];
    if (discovered?.careersUrl) {
      jobs.push({ type: 'enrich', enricher: 'careers', companyId, input: { url: discovered.careersUrl } });
    }
    if (discovered?.loginUrl) {
      jobs.push({ type: 'enrich', enricher: 'login', companyId, input: { url: discovered.loginUrl } });
    }
    return jobs;
  },
};

export const careersStrategy: ScraperStrategy = {
  pageType: 'careers',
  discoverLinks: false,
  onContentChange({ companyId }) {
    return [{ type: 'detect:website_analysis', companyId }];
  },
};

export const loginStrategy: ScraperStrategy = {
  pageType: 'login',
  discoverLinks: false,
  onContentChange({ companyId }) {
    return [{ type: 'detect:website_analysis', companyId }];
  },
};
