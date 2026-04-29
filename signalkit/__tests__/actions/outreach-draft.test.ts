import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  createOutreachDraftAction,
  OutreachDraftSchema,
} from '@/actions/outreach-draft';
import type { IAIClient } from '@/ai/client';
import type { PipelineContext } from '@/core/pipeline-context';
import { makeCompany, makeSignal } from '../_helpers/fixtures';

const mockDraft = {
  subject: 'Optimizing your infrastructure',
  body: 'Hi, I noticed your team uses AWS...',
  context_used: ['hosting signal', 'company profile'],
};

function createMockAIClient(response: unknown): IAIClient {
  return {
    analyze: vi.fn().mockImplementation(
      async <T>(_prompt: string, schema: z.ZodType<T>) => schema.parse(response),
    ),
  };
}

const ctx = {} as PipelineContext;

describe('OutreachDraftAction', () => {
  it('includes user context (from action config) in prompt', async () => {
    const client = createMockAIClient(mockDraft);
    const action = createOutreachDraftAction(client);

    await action.execute(
      makeCompany(),
      [makeSignal()],
      {
        senderName: 'Jane Doe',
        senderRole: 'Solutions Engineer',
        pitch: 'We help companies reduce cloud costs by 40%.',
      },
      ctx,
    );

    const prompt = (client.analyze as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain('Jane Doe');
    expect(prompt).toContain('Solutions Engineer');
    expect(prompt).toContain('reduce cloud costs');
  });

  it('falls back to default sender when config is empty', async () => {
    const client = createMockAIClient(mockDraft);
    const action = createOutreachDraftAction(client);

    await action.execute(makeCompany(), [makeSignal()], {}, ctx);

    const prompt = (client.analyze as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain('Sales Team');
  });

  it('OutreachDraftSchema validates correct input', () => {
    const result = OutreachDraftSchema.safeParse(mockDraft);
    expect(result.success).toBe(true);
  });
});
