import { describe, it, expect } from 'vitest';
import {
  getFieldValue,
  evaluateCondition,
  evaluateTrigger,
  computeSignalHash,
  type CompanyForEvaluation,
} from '@/core/trigger-evaluator';
import type { TriggerCondition, TriggerConditions } from '@/core/types';

interface SignalForEvaluation {
  signal_type: string;
  value: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// getFieldValue
// ---------------------------------------------------------------------------
describe('getFieldValue', () => {
  it('returns top-level field value', () => {
    expect(getFieldValue({ provider: 'aws' }, 'provider')).toBe('aws');
  });

  it('returns nested field via dot path', () => {
    const value = { infra: { cloud: 'gcp' } };
    expect(getFieldValue(value, 'infra.cloud')).toBe('gcp');
  });

  it('returns undefined for missing field', () => {
    expect(getFieldValue({ provider: 'aws' }, 'missing')).toBeUndefined();
  });

  it('handles null gracefully', () => {
    expect(getFieldValue({ nested: null }, 'nested.deep')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition
// ---------------------------------------------------------------------------
describe('evaluateCondition', () => {
  const hostingSignal: SignalForEvaluation = {
    signal_type: 'hosting',
    value: { provider: 'aws', has_devops: true, tags: ['cloud', 'saas'] },
  };

  const websiteSignal: SignalForEvaluation = {
    signal_type: 'website_analysis',
    value: { tech_stack: 'React', description: 'A cloud-based platform' },
  };

  const signals: SignalForEvaluation[] = [hostingSignal, websiteSignal];

  it("with 'exists' returns true when signal present", () => {
    const cond: TriggerCondition = { signal_type: 'hosting', operator: 'exists' };
    expect(evaluateCondition(cond, signals)).toBe(true);
  });

  it("with 'exists' returns false when signal missing", () => {
    const cond: TriggerCondition = { signal_type: 'dns_records', operator: 'exists' };
    expect(evaluateCondition(cond, signals)).toBe(false);
  });

  it("with 'eq' returns true when field matches", () => {
    const cond: TriggerCondition = {
      signal_type: 'hosting',
      field: 'provider',
      operator: 'eq',
      value: 'aws',
    };
    expect(evaluateCondition(cond, signals)).toBe(true);
  });

  it("with 'eq' returns false when field differs", () => {
    const cond: TriggerCondition = {
      signal_type: 'hosting',
      field: 'provider',
      operator: 'eq',
      value: 'gcp',
    };
    expect(evaluateCondition(cond, signals)).toBe(false);
  });

  it("with 'neq' returns true when field differs", () => {
    const cond: TriggerCondition = {
      signal_type: 'hosting',
      field: 'provider',
      operator: 'neq',
      value: 'gcp',
    };
    expect(evaluateCondition(cond, signals)).toBe(true);
  });

  it("with 'neq' returns false when field matches", () => {
    const cond: TriggerCondition = {
      signal_type: 'hosting',
      field: 'provider',
      operator: 'neq',
      value: 'aws',
    };
    expect(evaluateCondition(cond, signals)).toBe(false);
  });

  it("with 'contains' returns true when field contains value (string)", () => {
    const cond: TriggerCondition = {
      signal_type: 'website_analysis',
      field: 'description',
      operator: 'contains',
      value: 'cloud',
    };
    expect(evaluateCondition(cond, signals)).toBe(true);
  });

  it("with 'contains' returns true when field is array containing value", () => {
    const cond: TriggerCondition = {
      signal_type: 'hosting',
      field: 'tags',
      operator: 'contains',
      value: 'cloud',
    };
    expect(evaluateCondition(cond, signals)).toBe(true);
  });

  it("with 'contains' returns false when not contained", () => {
    const cond: TriggerCondition = {
      signal_type: 'website_analysis',
      field: 'description',
      operator: 'contains',
      value: 'blockchain',
    };
    expect(evaluateCondition(cond, signals)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — lt/gt operators
// ---------------------------------------------------------------------------
describe('evaluateCondition — lt/gt operators', () => {
  const signals: SignalForEvaluation[] = [
    { signal_type: 'metrics', value: { score: 75, rating: 'A' } },
  ];

  it("with 'lt' returns true when field is less than value", () => {
    const cond: TriggerCondition = {
      signal_type: 'metrics',
      field: 'score',
      operator: 'lt',
      value: 100,
    };
    expect(evaluateCondition(cond, signals)).toBe(true);
  });

  it("with 'lt' returns false when field is not less", () => {
    const cond: TriggerCondition = {
      signal_type: 'metrics',
      field: 'score',
      operator: 'lt',
      value: 50,
    };
    expect(evaluateCondition(cond, signals)).toBe(false);
  });

  it("with 'gt' returns true when field is greater than value", () => {
    const cond: TriggerCondition = {
      signal_type: 'metrics',
      field: 'score',
      operator: 'gt',
      value: 50,
    };
    expect(evaluateCondition(cond, signals)).toBe(true);
  });

  it("with 'gt' returns false when field is not greater", () => {
    const cond: TriggerCondition = {
      signal_type: 'metrics',
      field: 'score',
      operator: 'gt',
      value: 100,
    };
    expect(evaluateCondition(cond, signals)).toBe(false);
  });

  it("with 'lt' returns false for non-numeric values", () => {
    const cond: TriggerCondition = {
      signal_type: 'metrics',
      field: 'rating',
      operator: 'lt',
      value: 100,
    };
    expect(evaluateCondition(cond, signals)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluateCondition — company metadata source
// ---------------------------------------------------------------------------
describe('evaluateCondition — company metadata', () => {
  const signals: SignalForEvaluation[] = [];
  const company: CompanyForEvaluation = {
    metadata: { team_size: 25, one_liner: 'A dev tools startup' },
    source_data: { batch: 'W25', industry: 'developer_tools' },
  };

  it("with source='company' and 'eq' matches metadata field", () => {
    const cond: TriggerCondition = {
      source: 'company',
      signal_type: '_company',
      field: 'batch',
      operator: 'eq',
      value: 'W25',
    };
    expect(evaluateCondition(cond, signals, company)).toBe(true);
  });

  it("with source='company' and 'neq' on metadata field", () => {
    const cond: TriggerCondition = {
      source: 'company',
      signal_type: '_company',
      field: 'batch',
      operator: 'neq',
      value: 'S24',
    };
    expect(evaluateCondition(cond, signals, company)).toBe(true);
  });

  it("with source='company' and 'lt' on team_size", () => {
    const cond: TriggerCondition = {
      source: 'company',
      signal_type: '_company',
      field: 'team_size',
      operator: 'lt',
      value: 30,
    };
    expect(evaluateCondition(cond, signals, company)).toBe(true);
  });

  it("with source='company' and 'gt' on team_size", () => {
    const cond: TriggerCondition = {
      source: 'company',
      signal_type: '_company',
      field: 'team_size',
      operator: 'gt',
      value: 30,
    };
    expect(evaluateCondition(cond, signals, company)).toBe(false);
  });

  it("with source='company' and 'exists' on field", () => {
    const cond: TriggerCondition = {
      source: 'company',
      signal_type: '_company',
      field: 'team_size',
      operator: 'exists',
    };
    expect(evaluateCondition(cond, signals, company)).toBe(true);
  });

  it("with source='company' and 'exists' on missing field", () => {
    const cond: TriggerCondition = {
      source: 'company',
      signal_type: '_company',
      field: 'funding_amount',
      operator: 'exists',
    };
    expect(evaluateCondition(cond, signals, company)).toBe(false);
  });

  it("with source='company' and 'contains' on string field", () => {
    const cond: TriggerCondition = {
      source: 'company',
      signal_type: '_company',
      field: 'one_liner',
      operator: 'contains',
      value: 'dev tools',
    };
    expect(evaluateCondition(cond, signals, company)).toBe(true);
  });

  it("returns false if no company data provided", () => {
    const cond: TriggerCondition = {
      source: 'company',
      signal_type: '_company',
      field: 'batch',
      operator: 'eq',
      value: 'W25',
    };
    expect(evaluateCondition(cond, signals)).toBe(false);
  });

  it("prefers metadata over source_data for overlapping keys", () => {
    const companyOverlap: CompanyForEvaluation = {
      metadata: { batch: 'S24' },
      source_data: { batch: 'W25' },
    };
    const cond: TriggerCondition = {
      source: 'company',
      signal_type: '_company',
      field: 'batch',
      operator: 'eq',
      value: 'S24',
    };
    expect(evaluateCondition(cond, signals, companyOverlap)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateTrigger — mixed signal + company conditions
// ---------------------------------------------------------------------------
describe('evaluateTrigger — mixed conditions', () => {
  const signals: SignalForEvaluation[] = [
    { signal_type: 'hosting', value: { provider: 'heroku' } },
  ];
  const company: CompanyForEvaluation = {
    metadata: { team_size: 12 },
    source_data: { batch: 'W25' },
  };

  it("matches when both signal and company conditions pass (match='all')", () => {
    const conditions: TriggerConditions = {
      match: 'all',
      conditions: [
        { signal_type: 'hosting', field: 'provider', operator: 'eq', value: 'heroku' },
        { source: 'company', signal_type: '_company', field: 'team_size', operator: 'lt', value: 30 },
      ],
    };
    expect(evaluateTrigger(conditions, signals, company)).toBe(true);
  });

  it("fails when company condition fails (match='all')", () => {
    const conditions: TriggerConditions = {
      match: 'all',
      conditions: [
        { signal_type: 'hosting', field: 'provider', operator: 'eq', value: 'heroku' },
        { source: 'company', signal_type: '_company', field: 'batch', operator: 'eq', value: 'S24' },
      ],
    };
    expect(evaluateTrigger(conditions, signals, company)).toBe(false);
  });

  it("matches with match='any' when one company condition passes", () => {
    const conditions: TriggerConditions = {
      match: 'any',
      conditions: [
        { signal_type: 'dns_records', operator: 'exists' },
        { source: 'company', signal_type: '_company', field: 'batch', operator: 'eq', value: 'W25' },
      ],
    };
    expect(evaluateTrigger(conditions, signals, company)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateTrigger
// ---------------------------------------------------------------------------
describe('evaluateTrigger', () => {
  const signals: SignalForEvaluation[] = [
    { signal_type: 'hosting', value: { provider: 'aws', has_devops: true } },
    { signal_type: 'website_analysis', value: { tech_stack: 'React' } },
  ];

  it("with match='all' returns true when all conditions match", () => {
    const conditions: TriggerConditions = {
      match: 'all',
      conditions: [
        { signal_type: 'hosting', operator: 'exists' },
        { signal_type: 'hosting', field: 'provider', operator: 'eq', value: 'aws' },
      ],
    };
    expect(evaluateTrigger(conditions, signals)).toBe(true);
  });

  it("with match='all' returns false when any condition fails", () => {
    const conditions: TriggerConditions = {
      match: 'all',
      conditions: [
        { signal_type: 'hosting', field: 'provider', operator: 'eq', value: 'aws' },
        { signal_type: 'dns_records', operator: 'exists' },
      ],
    };
    expect(evaluateTrigger(conditions, signals)).toBe(false);
  });

  it("with match='any' returns true when any condition matches", () => {
    const conditions: TriggerConditions = {
      match: 'any',
      conditions: [
        { signal_type: 'dns_records', operator: 'exists' },
        { signal_type: 'hosting', operator: 'exists' },
      ],
    };
    expect(evaluateTrigger(conditions, signals)).toBe(true);
  });

  it("with match='any' returns false when no conditions match", () => {
    const conditions: TriggerConditions = {
      match: 'any',
      conditions: [
        { signal_type: 'dns_records', operator: 'exists' },
        { signal_type: 'ssl_cert', operator: 'exists' },
      ],
    };
    expect(evaluateTrigger(conditions, signals)).toBe(false);
  });

  it("with empty conditions returns true (vacuous truth for 'all')", () => {
    const conditions: TriggerConditions = { match: 'all', conditions: [] };
    expect(evaluateTrigger(conditions, signals)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeSignalHash
// ---------------------------------------------------------------------------
describe('computeSignalHash', () => {
  it('returns consistent hash for same signals', () => {
    const signals: SignalForEvaluation[] = [
      { signal_type: 'hosting', value: { provider: 'aws' } },
    ];
    const hash1 = computeSignalHash(signals);
    const hash2 = computeSignalHash(signals);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns different hash for different signal values', () => {
    const signals1: SignalForEvaluation[] = [
      { signal_type: 'hosting', value: { provider: 'aws' } },
    ];
    const signals2: SignalForEvaluation[] = [
      { signal_type: 'hosting', value: { provider: 'gcp' } },
    ];
    expect(computeSignalHash(signals1)).not.toBe(computeSignalHash(signals2));
  });

  it('is order-independent (sorts by signal_type)', () => {
    const a: SignalForEvaluation = { signal_type: 'aaa', value: { x: 1 } };
    const b: SignalForEvaluation = { signal_type: 'bbb', value: { y: 2 } };
    expect(computeSignalHash([a, b])).toBe(computeSignalHash([b, a]));
  });
});
