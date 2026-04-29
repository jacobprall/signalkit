import { describe, it, expect } from 'vitest';
import {
  createChangeAlertAction,
  ChangeAlertSchema,
} from '@/actions/change-alert';
import type { PipelineContext } from '@/core/pipeline-context';
import { makeCompany, makeSignal, createMockAIClient } from '../_helpers/fixtures';

const mockAlert = {
  change_description: 'Migrated from AWS to GCP.',
  significance: 'Major infrastructure change indicating cloud strategy shift.',
  previous_state: { provider: 'aws' },
  current_state: { provider: 'gcp' },
};

const ctx = {} as PipelineContext;

describe('ChangeAlertAction', () => {
  it('returns a validated ChangeAlert as ActionOutput', async () => {
    const action = createChangeAlertAction(createMockAIClient(mockAlert));
    const result = await action.execute(
      makeCompany(),
      [makeSignal({ previousValue: { provider: 'aws' }, value: { provider: 'gcp' } })],
      {},
      ctx,
    );

    expect(result.content.change_description).toBe('Migrated from AWS to GCP.');
    expect(result.content.previous_state).toEqual({ provider: 'aws' });
    expect(result.content.current_state).toEqual({ provider: 'gcp' });
  });

  it('succeeds when signals have no previousValue', async () => {
    const action = createChangeAlertAction(createMockAIClient(mockAlert));
    const result = await action.execute(
      makeCompany(),
      [makeSignal({ previousValue: null })],
      {},
      ctx,
    );
    expect(result.content).toBeDefined();
  });

  it('ChangeAlertSchema validates correct input', () => {
    expect(ChangeAlertSchema.safeParse(mockAlert).success).toBe(true);
  });
});
