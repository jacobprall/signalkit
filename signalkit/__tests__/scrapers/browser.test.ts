import { describe, it, expect } from 'vitest';
import { MockBrowserManager } from '@/scrapers/browser';

describe('MockBrowserManager', () => {
  it('returns configured page text', async () => {
    const browser = new MockBrowserManager();
    browser.setPage('https://example.com', 'Hello World');

    const text = await browser.extractText('https://example.com');
    expect(text).toBe('Hello World');
  });

  it('returns configured page text and hrefs', async () => {
    const browser = new MockBrowserManager();
    browser.setPage('https://example.com', 'Hello', ['/careers', '/about']);

    const result = await browser.extractTextAndLinks('https://example.com');
    expect(result.text).toBe('Hello');
    expect(result.hrefs).toEqual(['/careers', '/about']);
  });

  it('throws for unknown URLs on extractText', async () => {
    const browser = new MockBrowserManager();
    await expect(browser.extractText('https://unknown.com')).rejects.toThrow(
      'No mock page for https://unknown.com',
    );
  });

  it('throws for unknown URLs on extractTextAndLinks', async () => {
    const browser = new MockBrowserManager();
    await expect(
      browser.extractTextAndLinks('https://unknown.com'),
    ).rejects.toThrow('No mock page for https://unknown.com');
  });

  it('close is a no-op', async () => {
    const browser = new MockBrowserManager();
    await expect(browser.close()).resolves.toBeUndefined();
  });
});
