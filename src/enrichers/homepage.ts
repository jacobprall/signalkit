import { defineEnricher } from '@/core/define-plugin';
import { discoverLinks } from '@/scrapers/shared';

export function createHomepageEnricher() {
  return defineEnricher({
    name: 'homepage',
    triggersDetectors: ['product_analysis', 'tech_stack_analysis'],
    async enrich(company, input, ctx) {
      const url = input.url as string;
      const { text, hrefs } = await ctx.extractPageText(url);
      const { contentChanged } = await ctx.persistPage({
        companyId: company.id,
        url,
        pageType: 'homepage',
        contentText: text,
      });

      const followUp: import('@/core/types').JobPayload[] = [];
      const discovered = discoverLinks(url, hrefs);
      if (discovered.careersUrl) {
        followUp.push({
          type: 'enrich',
          enricher: 'careers',
          companyId: company.id,
          input: { url: discovered.careersUrl },
        });
      }
      if (discovered.loginUrl) {
        followUp.push({
          type: 'enrich',
          enricher: 'login',
          companyId: company.id,
          input: { url: discovered.loginUrl },
        });
      }

      return { contentChanged, followUp };
    },
  });
}
