import type { IAIClient } from '@/ai/client';
import { defineDetector, type DetectedSignal } from '@/core/define-plugin';
import { createLogger } from '@/lib/logger';
import {
  TechStackSchema,
  buildTechStackPrompt,
} from '@/ai/prompts/product-analysis';

const log = createLogger('detector:tech_stack_analysis');

export function createTechStackAnalysisDetector(aiClient: IAIClient) {
  return defineDetector({
    name: 'tech_stack_analysis',

    async detect(company, ctx): Promise<DetectedSignal[]> {
      const homepageText = await ctx.getPageText(company.id, 'homepage');
      if (!homepageText) {
        return [];
      }

      const scopedClient = aiClient.withContext
        ? aiClient.withContext({ action: 'tech_stack_analysis', companyId: company.id })
        : aiClient;

      const [loginText, careersText] = await Promise.all([
        ctx.getPageText(company.id, 'login'),
        ctx.getPageText(company.id, 'careers'),
      ]);

      const pages: { type: string; text: string }[] = [
        { type: 'homepage', text: homepageText },
        ...(loginText ? [{ type: 'login', text: loginText }] : []),
        ...(careersText ? [{ type: 'careers', text: careersText }] : []),
      ];

      try {
        const result = await scopedClient.analyze(
          buildTechStackPrompt(pages),
          TechStackSchema,
        );
        return [
          {
            signalType: 'tech_stack',
            source: 'ai_analysis',
            value: result as unknown as Record<string, unknown>,
            confidence: 0.75,
          },
        ];
      } catch (err) {
        log.error({ companyId: company.id, err }, 'tech stack analysis failed');
        return [];
      }
    },
  });
}
