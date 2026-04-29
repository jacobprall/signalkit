import { z } from 'zod';
import type { IAIClient } from '@/ai/client';
import { defineAIAction, formatSignalsList, getCompanyOneLiner } from './base';

export const CostAnalysisSchema = z.object({
  current_provider: z.string(),
  estimated_current_cost: z.string(),
  estimated_alternative_cost: z.string(),
  assumptions: z.array(z.string()),
  recommendation: z.string(),
});

export type CostAnalysis = z.infer<typeof CostAnalysisSchema>;

export function createCostAnalysisAction(aiClient: IAIClient) {
  return defineAIAction(aiClient, {
    name: 'cost_analysis',
    schema: CostAnalysisSchema,
    maxTokens: 1500,

    buildPrompt(company, signals, _config) {
      const oneLiner = getCompanyOneLiner(company) ?? 'No description';

      return `Perform a cost analysis for a company's infrastructure.

Company: ${company.name}
Domain: ${company.domain ?? 'Unknown'}
Description: ${oneLiner}

Infrastructure Signals:
${formatSignalsList(signals)}

Based on the detected signals, estimate:
1. current_provider: The current primary infrastructure provider
2. estimated_current_cost: Estimated monthly/annual cost range
3. estimated_alternative_cost: Estimated cost with an alternative solution
4. assumptions: List of assumptions made in the analysis
5. recommendation: A brief recommendation`;
    },
  });
}
