import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  JobPayload,
  TriggerCondition,
  TriggerConditions,
} from '@/core/types';
import type {
  CollectedRecord,
  DetectedSignal,
  ActionOutput,
} from '@/core/define-plugin';

describe('Core Types', () => {
  describe('JobPayload discriminated union', () => {
    it('narrows to collect:yc_directory', () => {
      const job: JobPayload = { type: 'collect:yc_directory' };
      if (job.type === 'collect:yc_directory') {
        expect(job.type).toBe('collect:yc_directory');
      }
    });

    it('narrows to scrape:homepage with companyId and url', () => {
      const job: JobPayload = {
        type: 'scrape:homepage',
        companyId: 'abc-123',
        url: 'https://example.com',
      };
      if (job.type === 'scrape:homepage') {
        expect(job.companyId).toBe('abc-123');
        expect(job.url).toBe('https://example.com');
      }
    });

    it('narrows to detect:hosting with companyId', () => {
      const job: JobPayload = { type: 'detect:hosting', companyId: 'abc-123' };
      if (job.type === 'detect:hosting') {
        expect(job.companyId).toBe('abc-123');
      }
    });

    it('narrows to action:run with the full payload', () => {
      const job: JobPayload = {
        type: 'action:run',
        actionRunId: 'ar-1',
        triggerId: 't-1',
        companyId: 'c-1',
        signalIds: ['s-1', 's-2'],
        actionType: 'prospect_brief',
        config: {},
        deliveries: [{ type: 'dashboard', config: {} }],
      };
      if (job.type === 'action:run') {
        expect(job.actionRunId).toBe('ar-1');
        expect(job.triggerId).toBe('t-1');
        expect(job.companyId).toBe('c-1');
        expect(job.signalIds).toEqual(['s-1', 's-2']);
      }
    });

    it('narrows to deliver with actionRunId and deliveryType', () => {
      const job: JobPayload = {
        type: 'deliver',
        actionRunId: 'ar-1',
        deliveryType: 'slack',
        deliveryConfig: { channel: '#alerts' },
      };
      if (job.type === 'deliver') {
        expect(job.actionRunId).toBe('ar-1');
        expect(job.deliveryType).toBe('slack');
        expect(job.deliveryConfig).toEqual({ channel: '#alerts' });
      }
    });

    it('narrows to evaluate_triggers with companyId', () => {
      const job: JobPayload = {
        type: 'evaluate_triggers',
        companyId: 'c-1',
      };
      if (job.type === 'evaluate_triggers') {
        expect(job.companyId).toBe('c-1');
      }
    });
  });

  describe('TriggerCondition', () => {
    it('supports eq operator', () => {
      const cond: TriggerCondition = {
        signal_type: 'hosting',
        field: 'provider',
        operator: 'eq',
        value: 'aws',
      };
      expect(cond.operator).toBe('eq');
    });

    it('supports neq operator', () => {
      const cond: TriggerCondition = {
        signal_type: 'hosting',
        operator: 'neq',
        value: 'on-prem',
      };
      expect(cond.operator).toBe('neq');
    });

    it('supports exists operator without value', () => {
      const cond: TriggerCondition = {
        signal_type: 'hiring',
        operator: 'exists',
      };
      expect(cond.operator).toBe('exists');
      expect(cond.value).toBeUndefined();
    });

    it('supports contains operator', () => {
      const cond: TriggerCondition = {
        signal_type: 'tech_stack',
        field: 'frameworks',
        operator: 'contains',
        value: 'react',
      };
      expect(cond.operator).toBe('contains');
    });

    it('constrains operators to the four allowed values', () => {
      expectTypeOf<TriggerCondition['operator']>().toEqualTypeOf<
        'eq' | 'neq' | 'exists' | 'contains'
      >();
    });
  });

  describe('TriggerConditions', () => {
    it('supports match all', () => {
      const tc: TriggerConditions = {
        match: 'all',
        conditions: [
          { signal_type: 'hosting', operator: 'exists' },
          { signal_type: 'hiring', operator: 'eq', value: true },
        ],
      };
      expect(tc.match).toBe('all');
      expect(tc.conditions).toHaveLength(2);
    });

    it('supports match any', () => {
      const tc: TriggerConditions = {
        match: 'any',
        conditions: [{ signal_type: 'hosting', operator: 'exists' }],
      };
      expect(tc.match).toBe('any');
    });
  });

  describe('Plugin interface shapes', () => {
    it('CollectedRecord has required fields', () => {
      const record: CollectedRecord = {
        source: 'yc_directory',
        sourceId: 'yc-123',
        data: { name: 'TestCo' },
      };
      expect(record.source).toBe('yc_directory');
      expect(record.sourceId).toBe('yc-123');
      expect(record.data).toEqual({ name: 'TestCo' });
    });

    it('DetectedSignal has required fields', () => {
      const signal: DetectedSignal = {
        signalType: 'hosting',
        source: 'dns_lookup',
        value: { provider: 'aws' },
        confidence: 0.95,
      };
      expect(signal.confidence).toBeGreaterThanOrEqual(0);
      expect(signal.confidence).toBeLessThanOrEqual(1);
    });

    it('ActionOutput has content field', () => {
      const output: ActionOutput = {
        content: { summary: 'Analysis complete' },
      };
      expect(output.content).toBeDefined();
    });
  });
});
