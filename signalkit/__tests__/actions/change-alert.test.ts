import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  createChangeAlertAction,
  ChangeAlertSchema,
} from '@/actions/change-alert';
import type { IAIClient } from '@/ai/client';
import type { PipelineContext } from '@/core/pipeline-context';
import { makeCompany, makeSignal } from '../_helpers/fixtures';

const mockAlert = {
  change_description: 'Migrated from AWS to GCP.',
  significance: 'Major infrastructure change indicating cloud strategy shift.',
  previous_state: { provider: 'aws' },
  current_state: { provider: 'gcp' },
};

function createMockAIClient(response: unknown): IAIClient {
  return {
    analyze: vi.fn().mockImplementation(
      async <T>(_prompt: string, schema: z.ZodType<T>) => schema.parse(response),
    ),
  };
}

const ctx = {} as PipelineContext;

describe('ChangeAlertAction', () => {
  it('includes previous and current state in prompt when signal has previousValue', async () => {
    const client = createMockAIClient(mockAlert);
    const action = createChangeAlertAction(client);

    await action.execute(
      makeCompany(),
      [
        makeSignal({
          signalType: 'hosting_detected',
          value: { provider: 'gcp' },
          previousValue: { provider: 'aws' },
        }),
      ],
      {},
      ctx,
    );

    const prompt = (client.analyze as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain('aws');
    expect(prompt).toContain('gcp');
    expect(prompt).toContain('Acme Corp');
  });

  it('falls back to current signals when none have previousValue', async () => {
    const client = createMockAIClient(mockAlert);
    const action = createChangeAlertAction(client);

    await action.execute(
      makeCompany(),
      [makeSignal({ previousValue: null })],
      {},
      ctx,
    );

    const prompt = (client.analyze as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain('No previous-state recorded');
  });

  it('ChangeAlertSchema validates correct input', () => {
    const result = ChangeAlertSchema.safeParse(mockAlert);
    expect(result.success).toBe(true);
  });
});
