import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  createProspectBriefAction,
  ProspectBriefSchema,
} from '@/actions/prospect-brief';
import type { IAIClient } from '@/ai/client';
import type { PipelineContext } from '@/core/pipeline-context';
import { makeCompany, makeSignal } from '../_helpers/fixtures';

const mockBrief = {
  summary: 'Acme is a cloud SaaS company.',
  infrastructure_assessment: 'Running on AWS with modern stack.',
  signals_summary: 'Hosting detected on AWS.',
  approach_angle: 'Cost optimization for cloud spend.',
  raw_signals: { hosting: { provider: 'aws' } },
};

function createMockAIClient(response: unknown): IAIClient {
  return {
    analyze: vi.fn().mockImplementation(
      async <T>(_prompt: string, schema: z.ZodType<T>) => schema.parse(response),
    ),
  };
}

const company = makeCompany();
const signals = [makeSignal({ signalType: 'hosting_detected', value: { provider: 'aws' } })];
const ctx = {} as PipelineContext;

describe('ProspectBriefAction', () => {
  it("name is 'prospect_brief'", () => {
    const client = createMockAIClient(mockBrief);
    const action = createProspectBriefAction(client);
    expect(action.name).toBe('prospect_brief');
  });

  it('execute calls AI client with prompt containing company data', async () => {
    const client = createMockAIClient(mockBrief);
    const action = createProspectBriefAction(client);

    await action.execute(company, signals, {}, ctx);

    expect(client.analyze).toHaveBeenCalledTimes(1);
    const prompt = (client.analyze as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain('Acme Corp');
    expect(prompt).toContain('acme.com');
  });

  it('execute calls AI client with prompt containing signal data', async () => {
    const client = createMockAIClient(mockBrief);
    const action = createProspectBriefAction(client);

    await action.execute(company, signals, {}, ctx);

    const prompt = (client.analyze as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(prompt).toContain('hosting_detected');
  });

  it('execute returns validated ProspectBrief wrapped as ActionOutput', async () => {
    const client = createMockAIClient(mockBrief);
    const action = createProspectBriefAction(client);

    const result = await action.execute(company, signals, {}, ctx);

    expect(result.content.summary).toBe('Acme is a cloud SaaS company.');
    expect(result.content.infrastructure_assessment).toBeDefined();
    expect(result.content.approach_angle).toBeDefined();
  });

  it('ProspectBriefSchema validates correct input', () => {
    const result = ProspectBriefSchema.safeParse(mockBrief);
    expect(result.success).toBe(true);
  });

  it('ProspectBriefSchema rejects missing fields', () => {
    const result = ProspectBriefSchema.safeParse({ summary: 'Just a summary' });
    expect(result.success).toBe(false);
  });
});
