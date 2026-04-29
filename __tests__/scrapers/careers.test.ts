import { describe, it, expect } from 'vitest';
import { CareersScraper } from '@/scrapers/careers';
import { MockBrowserManager } from '@/scrapers/browser';
import { MockPageRepository } from '@/scrapers/page-repository';

describe('CareersScraper', () => {
  function setup() {
    const browser = new MockBrowserManager();
    const pageRepo = new MockPageRepository();
    const scraper = new CareersScraper(browser, pageRepo);
    return { browser, pageRepo, scraper };
  }

  const companyId = '00000000-0000-0000-0000-000000000001';
  const url = 'https://example.com/careers';

  it('extracts text and stores page', async () => {
    const { browser, pageRepo, scraper } = setup();
    browser.setPage(url, 'Join our team! Open positions...');

    const result = await scraper.scrape(companyId, url);
    expect(result.pageId).toBeDefined();

    const stored = await pageRepo.findByUrl(url);
    expect(stored).not.toBeNull();
    expect(stored!.pageType).toBe('careers');
    expect(stored!.contentText).toBe('Join our team! Open positions...');
  });

  it('enqueues website_analysis when content changed', async () => {
    const { browser, scraper } = setup();
    browser.setPage(url, 'New openings available');

    const result = await scraper.scrape(companyId, url);
    expect(result.contentChanged).toBe(true);

    const analysisJob = result.jobsToEnqueue.find(
      (j) => j.type === 'detect:website_analysis',
    );
    expect(analysisJob).toBeDefined();
    expect(analysisJob).toMatchObject({
      type: 'detect:website_analysis',
      companyId,
    });
  });

  it('skips downstream jobs when content unchanged', async () => {
    const { browser, scraper } = setup();
    browser.setPage(url, 'Same careers page');

    await scraper.scrape(companyId, url);
    const result = await scraper.scrape(companyId, url);
    expect(result.contentChanged).toBe(false);
    expect(result.jobsToEnqueue).toEqual([]);
  });
});
