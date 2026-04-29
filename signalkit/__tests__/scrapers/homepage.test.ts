import { describe, it, expect } from 'vitest';
import { HomepageScraper } from '@/scrapers/homepage';
import { MockBrowserManager } from '@/scrapers/browser';
import { MockPageRepository } from '@/scrapers/page-repository';

describe('HomepageScraper', () => {
  function setup() {
    const browser = new MockBrowserManager();
    const pageRepo = new MockPageRepository();
    const scraper = new HomepageScraper(browser, pageRepo);
    return { browser, pageRepo, scraper };
  }

  const companyId = '00000000-0000-0000-0000-000000000001';
  const url = 'https://example.com';

  it('extracts text and stores page', async () => {
    const { browser, pageRepo, scraper } = setup();
    browser.setPage(url, 'Example Company Homepage', ['/about']);

    const result = await scraper.scrape(companyId, url);
    expect(result.pageId).toBeDefined();
    expect(typeof result.pageId).toBe('string');

    const stored = await pageRepo.findByUrl(url);
    expect(stored).not.toBeNull();
    expect(stored!.contentText).toBe('Example Company Homepage');
    expect(stored!.pageType).toBe('homepage');
  });

  it('returns contentChanged=true for new pages', async () => {
    const { browser, scraper } = setup();
    browser.setPage(url, 'New page content');

    const result = await scraper.scrape(companyId, url);
    expect(result.contentChanged).toBe(true);
  });

  it('returns contentChanged=false when hash matches', async () => {
    const { browser, scraper } = setup();
    browser.setPage(url, 'Same content', []);

    await scraper.scrape(companyId, url);
    const result = await scraper.scrape(companyId, url);
    expect(result.contentChanged).toBe(false);
  });

  it('enqueues careers scraper when careers link found', async () => {
    const { browser, scraper } = setup();
    browser.setPage(url, 'We are hiring!', ['/about', '/careers']);

    const result = await scraper.scrape(companyId, url);
    const careersJob = result.jobsToEnqueue.find(
      (j) => j.type === 'scrape:careers',
    );
    expect(careersJob).toBeDefined();
    expect(careersJob).toMatchObject({
      type: 'scrape:careers',
      companyId,
      url: 'https://example.com/careers',
    });
  });

  it('enqueues login scraper when login link found', async () => {
    const { browser, scraper } = setup();
    browser.setPage(url, 'Welcome', ['/login', '/about']);

    const result = await scraper.scrape(companyId, url);
    const loginJob = result.jobsToEnqueue.find(
      (j) => j.type === 'scrape:login',
    );
    expect(loginJob).toBeDefined();
    expect(loginJob).toMatchObject({
      type: 'scrape:login',
      companyId,
      url: 'https://example.com/login',
    });
  });

  it('enqueues no downstream jobs when content unchanged', async () => {
    const { browser, scraper } = setup();
    browser.setPage(url, 'Stable content', ['/careers', '/login']);

    await scraper.scrape(companyId, url);
    const result = await scraper.scrape(companyId, url);
    expect(result.jobsToEnqueue).toEqual([]);
  });

  it('handles browser errors gracefully', async () => {
    const { scraper } = setup();
    // No page configured in mock → browser will throw
    await expect(scraper.scrape(companyId, url)).rejects.toThrow();
  });
});
