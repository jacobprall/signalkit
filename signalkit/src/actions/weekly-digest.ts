import { z } from 'zod';
import type { IAIClient } from '@/ai/client';
import type { Company, Signal } from '@/core/types';
import { formatSignalsList } from './base';

export const WeeklyDigestSchema = z.object({
  period: z.string(),
  highlights: z.array(
    z.object({
      company_name: z.string(),
      summary: z.string(),
    }),
  ),
  narrative: z.string(),
});

export type WeeklyDigest = z.infer<typeof WeeklyDigestSchema>;

export interface DigestEntry {
  company: Pick<Company, 'name' | 'domain'>;
  signals: Pick<Signal, 'signalType' | 'value'>[];
}

// Portfolio-wide scheduled report. Not invoked through the per-company
// Action plugin contract — instead called directly by the cron service.
export class WeeklyDigestAction {
  readonly type = 'weekly_digest';

  constructor(private readonly aiClient: IAIClient) {}

  async execute(entries: readonly DigestEntry[]): Promise<WeeklyDigest> {
    const prompt = this.buildPrompt(entries);
    return this.aiClient.analyze(prompt, WeeklyDigestSchema, {
      maxTokens: 3000,
    });
  }

  private buildPrompt(entries: readonly DigestEntry[]): string {
    const companySections = entries
      .map((entry) => {
        const signalList = formatSignalsList(entry.signals as Signal[]);
        return `  Company: ${entry.company.name} (${entry.company.domain ?? 'no domain'})\n${signalList}`;
      })
      .join('\n\n');

    return `Generate a weekly intelligence digest.

Companies and their signals from this week:
${companySections}

Provide:
1. period: The time period covered (e.g. "Week of April 21-28, 2026")
2. highlights: For each notable company, a company_name and brief summary
3. narrative: An overall narrative tying together the week's intelligence themes`;
  }
}
