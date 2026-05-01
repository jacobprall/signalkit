import type { IAIClient } from '@/ai/client';
import { defineDetector, type DetectedSignal } from '@/core/define-plugin';
import { createLogger } from '@/lib/logger';
import {
  ProductAnalysisSchema,
  buildProductPrompt,
} from '@/ai/prompts/product-analysis';

const log = createLogger('detector:product_analysis');

export function createProductAnalysisDetector(aiClient: IAIClient) {
  return defineDetector({
    name: 'product_analysis',

    async detect(company, ctx): Promise<DetectedSignal[]> {
      const homepageText = await ctx.getPageText(company.id, 'homepage');
      if (!homepageText) {
        return [];
      }

      const scopedClient = aiClient.withContext
        ? aiClient.withContext({ action: 'product_analysis', companyId: company.id })
        : aiClient;

      const loginText = await ctx.getPageText(company.id, 'login');

      try {
        const result = await scopedClient.analyze(
          buildProductPrompt(homepageText, loginText ?? undefined),
          ProductAnalysisSchema,
        );
        return [
          {
            signalType: 'product_profile',
            source: 'ai_analysis',
            value: result as unknown as Record<string, unknown>,
            confidence: 0.8,
          },
        ];
      } catch (err) {
        log.error({ companyId: company.id, err }, 'product analysis failed');
        return [];
      }
    },
  });
}
