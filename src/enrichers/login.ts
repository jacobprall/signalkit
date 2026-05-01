import { defineEnricher } from '@/core/define-plugin';

export function createLoginEnricher() {
  return defineEnricher({
    name: 'login',
    triggersDetectors: ['product_analysis', 'tech_stack_analysis'],
    async enrich(company, input, ctx) {
      const url = input.url as string;
      const { text } = await ctx.extractPageText(url);
      const { contentChanged } = await ctx.persistPage({
        companyId: company.id,
        url,
        pageType: 'login',
        contentText: text,
      });

      return { contentChanged };
    },
  });
}
