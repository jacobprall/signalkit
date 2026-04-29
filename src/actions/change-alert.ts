import { z } from 'zod';
import type { IAIClient } from '@/ai/client';
import { defineAIAction, formatSignalsList, getCompanyOneLiner } from './base';
import { stableStringify } from '@/utils/stable-stringify';

export const ChangeAlertSchema = z.object({
  change_description: z.string(),
  significance: z.string(),
  previous_state: z.record(z.string(), z.any()),
  current_state: z.record(z.string(), z.any()),
});

export type ChangeAlert = z.infer<typeof ChangeAlertSchema>;

export function createChangeAlertAction(aiClient: IAIClient) {
  return defineAIAction(aiClient, {
    name: 'change_alert',
    schema: ChangeAlertSchema,
    maxTokens: 1000,

    buildPrompt(company, signals, _config) {
      const oneLiner = getCompanyOneLiner(company) ?? 'No description';
      const changed = signals.filter((s) => s.previousValue !== null);

      const changesBlock = changed.length
        ? changed
            .map(
              (s) =>
                `Signal: ${s.signalType}\n  Previous: ${stableStringify(s.previousValue)}\n  Current: ${stableStringify(s.value)}`,
            )
            .join('\n\n')
        : `No previous-state recorded; current signals are:\n${formatSignalsList(signals)}`;

      return `Analyze the following changes detected for a company.

Company: ${company.name}
Domain: ${company.domain ?? 'Unknown'}
Description: ${oneLiner}

Detected Changes:
${changesBlock}

Provide:
1. change_description: Clear description of what changed
2. significance: Why this change matters for sales/business development
3. previous_state: Structured summary of the previous state
4. current_state: Structured summary of the current state`;
    },
  });
}
