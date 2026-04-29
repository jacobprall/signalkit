import { describe, it, expect } from 'vitest';
import {
  createProspectBriefAction,
  ProspectBriefSchema,
} from '@/actions/prospect-brief';
import type { PipelineContext } from '@/core/pipeline-context';
import { makeCompany, makeSignal, createMockAIClient } from '../_helpers/fixtures';

const mockBrief = {
  summary: 'Acme is a cloud SaaS company.',
  infrastructure_assessment: 'Running on AWS with modern stack.',
  signals_summary: 'Hosting detected on AWS.',
  approach_angle: 'Cost optimization for cloud spend.',
  raw_signals: { hosting: { provider: 'aws' } },
};

const company = makeCompany();
const signals = [makeSignal({ signalType: 'hosting_detected', value: { provider: 'aws' } })];
const ctx = {} as PipelineContext;

describe('ProspectBriefAction', () => {
  it("name is 'prospect_brief'", () => {
    const action = createProspectBriefAction(createMockAIClient(mockBrief));
    expect(action.name).toBe('prospect_brief');
  });

  it('returns validated ProspectBrief as ActionOutput', async () => {
    const action = createProspectBriefAction(createMockAIClient(mockBrief));
    const result = await action.execute(company, signals, {}, ctx);

    expect(result.content.summary).toBe('Acme is a cloud SaaS company.');
    expect(result.content.infrastructure_assessment).toBeDefined();
    expect(result.content.approach_angle).toBeDefined();
    expect(result.content.raw_signals).toEqual({ hosting: { provider: 'aws' } });
  });

  it('ProspectBriefSchema validates correct input', () => {
    expect(ProspectBriefSchema.safeParse(mockBrief).success).toBe(true);
  });

  it('ProspectBriefSchema rejects missing fields', () => {
    expect(ProspectBriefSchema.safeParse({ summary: 'Just a summary' }).success).toBe(false);
  });
});
