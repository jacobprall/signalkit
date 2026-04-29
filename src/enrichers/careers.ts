import { defineEnricher } from '@/core/define-plugin';

export function createCareersEnricher() {
  return defineEnricher({
    name: 'careers',
    triggersDetectors: ['website_analysis'],
    async enrich(company, input, ctx) {
      const url = input.url as string;
      const { text } = await ctx.extractPageText(url);
      const { contentChanged } = await ctx.persistPage({
        companyId: company.id,
        url,
        pageType: 'careers',
        contentText: text,
      });

      return { contentChanged };
    },
  });
}
