import { describe, it, expect } from 'vitest';
import {
  CreateTriggerSchema,
  UpdateTriggerSchema,
  TriggerActionSchema,
} from '@/app/api/validation';

describe('CreateTriggerSchema', () => {
  const validInput = {
    name: 'Hosting change alert',
    conditions: [
      { signal_type: 'hosting_provider', operator: 'eq' as const, value: 'render' },
    ],
    action_type: 'prospect_brief',
  };

  it('validates correct input', () => {
    const result = CreateTriggerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Hosting change alert');
      expect(result.data.conditions).toHaveLength(1);
      expect(result.data.action_type).toBe('prospect_brief');
    }
  });

  it('requires name', () => {
    const result = CreateTriggerSchema.safeParse({
      ...validInput,
      name: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = CreateTriggerSchema.safeParse({
      ...validInput,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 200 characters', () => {
    const result = CreateTriggerSchema.safeParse({
      ...validInput,
      name: 'a'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one condition', () => {
    const result = CreateTriggerSchema.safeParse({
      ...validInput,
      conditions: [],
    });
    expect(result.success).toBe(false);
  });

  it('validates operator enum', () => {
    const result = CreateTriggerSchema.safeParse({
      ...validInput,
      conditions: [
        { signal_type: 'hosting_provider', operator: 'invalid_op' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid operators', () => {
    for (const op of ['eq', 'neq', 'exists', 'contains'] as const) {
      const result = CreateTriggerSchema.safeParse({
        ...validInput,
        conditions: [{ signal_type: 'hosting_provider', operator: op }],
      });
      expect(result.success).toBe(true);
    }
  });

  it('defaults match to all', () => {
    const result = CreateTriggerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.match).toBe('all');
    }
  });

  it('accepts match any', () => {
    const result = CreateTriggerSchema.safeParse({
      ...validInput,
      match: 'any',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.match).toBe('any');
    }
  });

  it('defaults deliveries to dashboard', () => {
    const result = CreateTriggerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deliveries).toEqual([{ type: 'dashboard', config: {} }]);
    }
  });

  it('defaults action_config to empty object', () => {
    const result = CreateTriggerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action_config).toEqual({});
    }
  });

  it('defaults evaluation to on_new_signal', () => {
    const result = CreateTriggerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.evaluation).toBe('on_new_signal');
    }
  });

  it('accepts daily and weekly evaluation', () => {
    for (const evaluation of ['daily', 'weekly'] as const) {
      const result = CreateTriggerSchema.safeParse({ ...validInput, evaluation });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.evaluation).toBe(evaluation);
      }
    }
  });

  it('allows optional field in conditions', () => {
    const result = CreateTriggerSchema.safeParse({
      ...validInput,
      conditions: [
        { signal_type: 'team_size', field: 'count', operator: 'eq', value: 10 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conditions[0].field).toBe('count');
    }
  });
});

describe('UpdateTriggerSchema', () => {
  it('allows partial updates', () => {
    const result = UpdateTriggerSchema.safeParse({ name: 'Updated name' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Updated name');
    }
  });

  it('allows is_active toggle', () => {
    const result = UpdateTriggerSchema.safeParse({ is_active: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_active).toBe(false);
    }
  });

  it('allows empty body', () => {
    const result = UpdateTriggerSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('still validates field constraints when provided', () => {
    const result = UpdateTriggerSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('still validates conditions min length when provided', () => {
    const result = UpdateTriggerSchema.safeParse({ conditions: [] });
    expect(result.success).toBe(false);
  });
});

describe('TriggerActionSchema', () => {
  it('validates prospect_brief action type', () => {
    const result = TriggerActionSchema.safeParse({ actionType: 'prospect_brief' });
    expect(result.success).toBe(true);
  });

  it('validates outreach_draft action type', () => {
    const result = TriggerActionSchema.safeParse({ actionType: 'outreach_draft' });
    expect(result.success).toBe(true);
  });

  it('validates cost_analysis action type', () => {
    const result = TriggerActionSchema.safeParse({ actionType: 'cost_analysis' });
    expect(result.success).toBe(true);
  });

  it('validates change_alert action type', () => {
    const result = TriggerActionSchema.safeParse({ actionType: 'change_alert' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action type', () => {
    const result = TriggerActionSchema.safeParse({ actionType: 'invalid_type' });
    expect(result.success).toBe(false);
  });

  it('defaults config to empty object', () => {
    const result = TriggerActionSchema.safeParse({ actionType: 'prospect_brief' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toEqual({});
    }
  });

  it('passes through arbitrary config', () => {
    const result = TriggerActionSchema.safeParse({
      actionType: 'prospect_brief',
      config: { tone: 'formal', length: 'short' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toEqual({ tone: 'formal', length: 'short' });
    }
  });
});
