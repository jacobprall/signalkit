import type { ZodSchema } from 'zod';
import type { IAIClient } from '@/ai/client';
import type { Company, Signal } from '@/db/schema';
import { defineAction, type ActionOutput, type ActionDefinition } from '@/core/define-plugin';
import { stableStringify } from '@/utils/stable-stringify';

export { stableStringify } from '@/utils/stable-stringify';

export interface AIActionConfig {
  readonly name: string;
  readonly schema: ZodSchema;
  readonly maxTokens?: number;
  buildPrompt(company: Company, signals: Signal[], config: Record<string, unknown>): string;
}

/**
 * Factory for AI-backed per-company actions. Wraps an AI client call
 * with schema validation into a `defineAction` plugin.
 */
export function defineAIAction(
  aiClient: IAIClient,
  actionConfig: AIActionConfig,
): ActionDefinition {
  return defineAction({
    name: actionConfig.name,
    schema: actionConfig.schema,

    async execute(company, signals, config, _ctx): Promise<ActionOutput> {
      const client = aiClient.withContext
        ? aiClient.withContext({ action: actionConfig.name, companyId: company.id })
        : aiClient;
      const prompt = actionConfig.buildPrompt(company, signals, config);
      const result = await client.analyze(prompt, actionConfig.schema, {
        maxTokens: actionConfig.maxTokens ?? 2000,
      });
      return { content: result as Record<string, unknown> };
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers used by every AI prompt template.
// ---------------------------------------------------------------------------

export function formatSignalsList(signals: readonly Signal[]): string {
  if (signals.length === 0) return '(no signals detected)';
  return signals
    .map((s) => `- ${s.signalType}: ${stableStringify(s.value)}`)
    .join('\n');
}

export function getCompanyOneLiner(company: {
  metadata?: unknown;
  sourceData?: unknown;
}): string | null {
  const meta = (company.sourceData ?? company.metadata) as
    | Record<string, unknown>
    | null
    | undefined;
  if (!meta) return null;
  return (meta.one_liner as string) ?? (meta.oneLiner as string) ?? null;
}
