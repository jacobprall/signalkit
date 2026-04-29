import { z } from 'zod';
import type { IAIClient } from '@/ai/client';
import { defineAIAction, formatSignalsList, getCompanyOneLiner } from './base';

export const OutreachDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
  context_used: z.array(z.string()),
});

export type OutreachDraft = z.infer<typeof OutreachDraftSchema>;

export const OutreachConfigSchema = z.object({
  senderName: z.string().default('Sales Team'),
  senderRole: z.string().default('Account Executive'),
  pitch: z
    .string()
    .default(
      'Modern cloud infrastructure with better performance and lower costs',
    ),
});

export type OutreachConfig = z.infer<typeof OutreachConfigSchema>;

export function createOutreachDraftAction(aiClient: IAIClient) {
  return defineAIAction(aiClient, {
    name: 'outreach_draft',
    schema: OutreachDraftSchema,
    maxTokens: 1500,

    buildPrompt(company, signals, config) {
      const cfg = OutreachConfigSchema.parse(config);
      const oneLiner = getCompanyOneLiner(company) ?? 'No description';

      return `Draft a personalized outreach email.

Sender: ${cfg.senderName}, ${cfg.senderRole}
Value Proposition: ${cfg.pitch}

Target Company: ${company.name}
Domain: ${company.domain ?? 'Unknown'}
Description: ${oneLiner}

Intelligence Signals:
${formatSignalsList(signals)}

Write a concise, personalized cold email that:
1. References specific signals/intelligence about their company
2. Connects the sender's value proposition to a specific pain point
3. Has a compelling subject line
4. Is under 150 words in the body

Return: subject, body, and context_used (list of signals/facts referenced)`;
    },
  });
}
