import { z } from 'zod';
import type { IAIClient } from '@/ai/client';
import { defineAIAction, formatSignalsList, getCompanyOneLiner } from './base';
import { stableStringify } from '@/utils/stable-stringify';

export const ProspectBriefSchema = z.object({
  summary: z.string(),
  infrastructure_assessment: z.string(),
  signals_summary: z.string(),
  approach_angle: z.string(),
  raw_signals: z.record(z.string(), z.any()),
});

export type ProspectBrief = z.infer<typeof ProspectBriefSchema>;

export function createProspectBriefAction(aiClient: IAIClient) {
  return defineAIAction(aiClient, {
    name: 'prospect_brief',
    schema: ProspectBriefSchema,
    maxTokens: 2000,

    buildPrompt(company, signals, _config) {
      const oneLiner = getCompanyOneLiner(company) ?? 'No description available';
      const sourceData = company.sourceData
        ? stableStringify(company.sourceData)
        : 'None';

      return `Generate a prospect brief for a sales team.

Company: ${company.name}
Domain: ${company.domain ?? 'Unknown'}
Description: ${oneLiner}
Source Data: ${sourceData}

Detected Signals:
${formatSignalsList(signals)}

Provide a structured analysis with:
1. summary: A concise overview of the company and its relevance
2. infrastructure_assessment: Analysis of their technical infrastructure based on signals
3. signals_summary: What the detected signals tell us about this company
4. approach_angle: The best angle to approach this company for sales
5. raw_signals: The raw signal data for reference`;
    },
  });
}
