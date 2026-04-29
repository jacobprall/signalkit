import { describe, it, expect } from 'vitest';
import { createHomepageEnricher } from '@/enrichers/homepage';
import { makeCompany, makeContext } from '../_helpers/fixtures';

describe('HomepageEnricher', () => {
  const enricher = createHomepageEnricher();
  const company = makeCompany();
  const url = 'https://acme.com';

  it('has kind enricher and name homepage', () => {
    expect(enricher.kind).toBe('enricher');
    expect(enricher.name).toBe('homepage');
  });

  it('declares triggersDetectors for website_analysis', () => {
    expect(enricher.triggersDetectors).toEqual(['website_analysis']);
  });

  it('reports contentChanged when page is new', async () => {
    const ctx = makeContext();
    const result = await enricher.enrich(company, { url }, ctx);
    expect(result.contentChanged).toBe(true);
  });

  it('enqueues careers enricher when careers link found', async () => {
    const ctx = makeContext({
      extractPageText: {
        text: 'We are hiring!',
        hrefs: ['https://acme.com/about', 'https://acme.com/careers'],
      },
    });

    const result = await enricher.enrich(company, { url }, ctx);
    const careersJob = result.followUp?.find(
      (j) => j.type === 'enrich' && 'enricher' in j && j.enricher === 'careers',
    );
    expect(careersJob).toBeDefined();
    expect(careersJob).toMatchObject({
      type: 'enrich',
      enricher: 'careers',
      companyId: company.id,
    });
  });

  it('enqueues login enricher when login link found', async () => {
    const ctx = makeContext({
      extractPageText: {
        text: 'Welcome',
        hrefs: ['https://acme.com/login', 'https://acme.com/about'],
      },
    });

    const result = await enricher.enrich(company, { url }, ctx);
    const loginJob = result.followUp?.find(
      (j) => j.type === 'enrich' && 'enricher' in j && j.enricher === 'login',
    );
    expect(loginJob).toBeDefined();
    expect(loginJob).toMatchObject({
      type: 'enrich',
      enricher: 'login',
      companyId: company.id,
    });
  });

  it('returns no followUp when content unchanged', async () => {
    const ctx = makeContext({
      persistPage: { pageId: 'page-1', contentChanged: false },
      extractPageText: {
        text: 'Stable content',
        hrefs: ['https://acme.com/careers', 'https://acme.com/login'],
      },
    });

    const result = await enricher.enrich(company, { url }, ctx);
    expect(result.contentChanged).toBe(false);
    expect(result.followUp).toEqual([]);
  });
});
