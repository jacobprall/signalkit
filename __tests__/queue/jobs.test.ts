import { describe, it, expect } from 'vitest';
import {
  JOB_TYPES,
  getRetryPolicy,
  getConcurrencyLimit,
} from '@/queue/jobs';

describe('JOB_TYPES', () => {
  it('all values are unique', () => {
    const values = Object.values(JOB_TYPES);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('getRetryPolicy', () => {
  it.each(Object.values(JOB_TYPES))('returns a valid policy for %s', (jobType) => {
    const policy = getRetryPolicy(jobType);
    expect(policy.attempts).toBeGreaterThanOrEqual(1);
    expect(policy.backoff.type).toMatch(/^(exponential|fixed)$/);
    expect(policy.backoff.delay).toBeGreaterThan(0);
  });

  it('returns a sensible default for unknown job types', () => {
    const policy = getRetryPolicy('unknown:type');
    expect(policy.attempts).toBeGreaterThanOrEqual(1);
    expect(policy.backoff.type).toMatch(/^(exponential|fixed)$/);
    expect(policy.backoff.delay).toBeGreaterThan(0);
  });
});

describe('getConcurrencyLimit', () => {
  it.each(Object.values(JOB_TYPES))('returns a positive limit for %s', (jobType) => {
    expect(getConcurrencyLimit(jobType)).toBeGreaterThan(0);
  });

  it('returns a positive default for unknown job types', () => {
    expect(getConcurrencyLimit('unknown:type')).toBeGreaterThan(0);
  });
});
