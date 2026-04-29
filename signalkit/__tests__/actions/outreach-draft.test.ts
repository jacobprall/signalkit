import { describe, it, expect } from 'vitest';
import {
  createOutreachDraftAction,
  OutreachDraftSchema,
} from '@/actions/outreach-draft';
import type { PipelineContext } from '@/core/pipeline-context';
import { makeCompany, makeSignal, createMockAIClient } from '../_helpers/fixtures';

const mockDraft = {
  subject: 'Optimizing your infrastructure',
  body: 'Hi, I noticed your team uses AWS...',
  context_used: ['hosting signal', 'company profile'],
};

const ctx = {} as PipelineContext;

describe('OutreachDraftAction', () => {
  it('returns a validated OutreachDraft as ActionOutput', async () => {
    const action = createOutreachDraftAction(createMockAIClient(mockDraft));
    const result = await action.execute(
      makeCompany(),
      [makeSignal()],
      { senderName: 'Jane Doe', senderRole: 'Solutions Engineer', pitch: 'We help reduce cloud costs.' },
      ctx,
    );

    expect(result.content.subject).toBe('Optimizing your infrastructure');
    expect(result.content.body).toContain('AWS');
    expect(result.content.context_used).toHaveLength(2);
  });

  it('succeeds with empty config (uses defaults)', async () => {
    const action = createOutreachDraftAction(createMockAIClient(mockDraft));
    const result = await action.execute(makeCompany(), [makeSignal()], {}, ctx);
    expect(result.content.subject).toBeDefined();
  });

  it('OutreachDraftSchema validates correct input', () => {
    expect(OutreachDraftSchema.safeParse(mockDraft).success).toBe(true);
  });
});
