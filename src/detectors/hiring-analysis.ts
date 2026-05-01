import type { IAIClient } from '@/ai/client';
import { defineDetector, type DetectedSignal } from '@/core/define-plugin';
import { createLogger } from '@/lib/logger';
import {
  CareersAnalysisSchema,
  buildCareersPrompt,
} from '@/ai/prompts/careers-analysis';

const log = createLogger('detector:hiring_analysis');

export function createHiringAnalysisDetector(aiClient: IAIClient) {
  return defineDetector({
    name: 'hiring_analysis',
    triggersDetectors: [],

    async detect(company, ctx): Promise<DetectedSignal[]> {
      const careersText = await ctx.getPageText(company.id, 'careers');
      if (!careersText) {
        return [];
      }

      const scopedClient = aiClient.withContext
        ? aiClient.withContext({ action: 'hiring_analysis', companyId: company.id })
        : aiClient;

      try {
        const result = await scopedClient.analyze(
          buildCareersPrompt(careersText),
          CareersAnalysisSchema,
        );
        return [
          {
            signalType: 'hiring_activity',
            source: 'ai_analysis',
            value: result as unknown as Record<string, unknown>,
            confidence: 0.85,
          },
        ];
      } catch (err) {
        log.error({ companyId: company.id, err }, 'hiring analysis failed');
        return [];
      }
    },
  });
}
