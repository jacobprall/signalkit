import { describe, it, expect } from 'vitest';
import {
  contentHash,
  discoverLinks,
  cleanText,
  truncateToWords,
} from '@/scrapers/shared';

describe('contentHash', () => {
  it('produces consistent SHA256 hex strings', () => {
    const hash = contentHash('hello world');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(contentHash('hello world')).toBe(hash);
  });

  it('produces different hashes for different inputs', () => {
    expect(contentHash('hello')).not.toBe(contentHash('world'));
  });
});

describe('discoverLinks', () => {
  const base = 'https://example.com';

  it('finds /careers URL', () => {
    const result = discoverLinks(base, ['/about', '/careers']);
    expect(result.careersUrl).toBe('https://example.com/careers');
  });

  it('finds /jobs URL', () => {
    const result = discoverLinks(base, ['/about', '/jobs']);
    expect(result.careersUrl).toBe('https://example.com/jobs');
  });

  it('finds /login URL', () => {
    const result = discoverLinks(base, ['/about', '/login']);
    expect(result.loginUrl).toBe('https://example.com/login');
  });

  it('finds /app URL', () => {
    const result = discoverLinks(base, ['/about', '/app']);
    expect(result.loginUrl).toBe('https://example.com/app');
  });

  it('resolves relative URLs against base', () => {
    const result = discoverLinks('https://example.com/page', ['careers']);
    expect(result.careersUrl).toBe('https://example.com/careers');
  });

  it('returns null when no matches', () => {
    const result = discoverLinks(base, ['/about', '/contact', '/blog']);
    expect(result.careersUrl).toBeNull();
    expect(result.loginUrl).toBeNull();
  });

  it('ignores external URLs (different domain)', () => {
    const result = discoverLinks(base, [
      'https://other-site.com/careers',
      'https://other-site.com/login',
    ]);
    expect(result.careersUrl).toBeNull();
    expect(result.loginUrl).toBeNull();
  });

  it('matches subdomain URLs', () => {
    const result = discoverLinks(base, ['https://jobs.example.com/openings']);
    expect(result.careersUrl).toBe('https://jobs.example.com/openings');
  });

  it('matches careers. subdomain pattern', () => {
    const result = discoverLinks(base, ['https://careers.example.com']);
    expect(result.careersUrl).toBe('https://careers.example.com/');
  });

  it('returns first match per category', () => {
    const result = discoverLinks(base, ['/careers', '/jobs', '/login', '/app']);
    expect(result.careersUrl).toBe('https://example.com/careers');
    expect(result.loginUrl).toBe('https://example.com/login');
  });
});

describe('cleanText', () => {
  it('removes excessive whitespace', () => {
    expect(cleanText('hello   world')).toBe('hello world');
  });

  it('removes empty lines', () => {
    expect(cleanText('hello\n\n\nworld')).toBe('hello\nworld');
  });

  it('trims leading and trailing whitespace', () => {
    expect(cleanText('  hello  ')).toBe('hello');
  });
});

describe('truncateToWords', () => {
  it('truncates correctly when over limit', () => {
    const text = 'one two three four five';
    expect(truncateToWords(text, 3)).toBe('one two three...');
  });

  it('returns full text when under limit', () => {
    const text = 'one two three';
    expect(truncateToWords(text, 5)).toBe('one two three');
  });

  it('returns full text when exactly at limit', () => {
    const text = 'one two three';
    expect(truncateToWords(text, 3)).toBe('one two three');
  });
});
