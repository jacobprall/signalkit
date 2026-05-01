import { describe, it, expect } from 'vitest';
import { createLoginEnricher } from '@/enrichers/login';
import { createCareersEnricher } from '@/enrichers/careers';
import { makeCompany, makeContext } from '../_helpers/fixtures';

const enricherCases = [
  { factory: createLoginEnricher, name: 'login', url: 'https://acme.com/login' },
  { factory: createCareersEnricher, name: 'careers', url: 'https://acme.com/careers' },
] as const;

describe.each(enricherCases)('$name enricher', ({ factory, name, url }) => {
  const enricher = factory();
  const company = makeCompany();

  it(`has kind enricher and name ${name}`, () => {
    expect(enricher.kind).toBe('enricher');
    expect(enricher.name).toBe(name);
  });

  it('declares triggersDetectors for split detectors', () => {
    const expected = name === 'careers'
      ? ['hiring_analysis', 'tech_stack_analysis']
      : ['product_analysis', 'tech_stack_analysis'];
    expect(enricher.triggersDetectors).toEqual(expected);
  });

  it('reports contentChanged true for new content', async () => {
    const ctx = makeContext();
    const result = await enricher.enrich(company, { url }, ctx);
    expect(result.contentChanged).toBe(true);
  });

  it('reports contentChanged false when page unchanged', async () => {
    const ctx = makeContext({
      persistPage: { pageId: 'page-1', contentChanged: false },
    });
    const result = await enricher.enrich(company, { url }, ctx);
    expect(result.contentChanged).toBe(false);
  });
});
