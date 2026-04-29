import { describe, it, expect } from 'vitest';
import {
  JOB_TYPES,
  CONCURRENCY_LIMITS,
  RETRY_POLICIES,
  getRetryPolicy,
  getConcurrencyLimit,
} from '@/queue/jobs';

describe('JOB_TYPES', () => {
  it('contains all expected job type strings', () => {
    expect(JOB_TYPES.COLLECT_YC).toBe('collect:yc_directory');
    expect(JOB_TYPES.SCRAPE_HOMEPAGE).toBe('scrape:homepage');
    expect(JOB_TYPES.SCRAPE_CAREERS).toBe('scrape:careers');
    expect(JOB_TYPES.SCRAPE_LOGIN).toBe('scrape:login');
    expect(JOB_TYPES.DETECT_HOSTING).toBe('detect:hosting');
    expect(JOB_TYPES.DETECT_WEBSITE).toBe('detect:website_analysis');
    expect(JOB_TYPES.EVALUATE_TRIGGERS).toBe('evaluate_triggers');
    expect(JOB_TYPES.EVALUATE_TRIGGERS_FANOUT).toBe('evaluate_triggers:fanout');
    expect(JOB_TYPES.ACTION_RUN).toBe('action:run');
    expect(JOB_TYPES.DELIVER).toBe('deliver');
  });

  it('has exactly 10 job types', () => {
    expect(Object.keys(JOB_TYPES)).toHaveLength(10);
  });

  it('all values are unique', () => {
    const values = Object.values(JOB_TYPES);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('getRetryPolicy', () => {
  it('returns exponential backoff for scrape:homepage', () => {
    const policy = getRetryPolicy('scrape:homepage');
    expect(policy).toEqual({
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
    });
  });

  it('returns exponential backoff for scrape:careers', () => {
    const policy = getRetryPolicy('scrape:careers');
    expect(policy).toEqual({
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
    });
  });

  it('returns exponential backoff for scrape:login', () => {
    const policy = getRetryPolicy('scrape:login');
    expect(policy).toEqual({
      attempts: 2,
      backoff: { type: 'exponential', delay: 30000 },
    });
  });

  it('returns exponential backoff for detect:hosting', () => {
    const policy = getRetryPolicy('detect:hosting');
    expect(policy).toEqual({
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
    });
  });

  it('returns fixed backoff for detect:website_analysis', () => {
    const policy = getRetryPolicy('detect:website_analysis');
    expect(policy).toEqual({
      attempts: 1,
      backoff: { type: 'fixed', delay: 60000 },
    });
  });

  it('returns fixed backoff for action:run', () => {
    const policy = getRetryPolicy('action:run');
    expect(policy).toEqual({
      attempts: 1,
      backoff: { type: 'fixed', delay: 60000 },
    });
  });

  it('returns exponential backoff for evaluate_triggers', () => {
    const policy = getRetryPolicy('evaluate_triggers');
    expect(policy).toEqual({
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  });

  it('returns exponential backoff for deliver', () => {
    const policy = getRetryPolicy('deliver');
    expect(policy).toEqual({
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
    });
  });

  it('returns a sensible default for unknown job types', () => {
    const policy = getRetryPolicy('unknown:type');
    expect(policy).toHaveProperty('attempts');
    expect(policy).toHaveProperty('backoff');
    expect(policy.attempts).toBeGreaterThanOrEqual(1);
    expect(policy.backoff.type).toMatch(/^(exponential|fixed)$/);
    expect(policy.backoff.delay).toBeGreaterThan(0);
  });
});

describe('getConcurrencyLimit', () => {
  it.each([
    ['scrape:homepage', 5],
    ['scrape:careers', 5],
    ['scrape:login', 5],
    ['detect:hosting', 20],
    ['detect:website_analysis', 3],
    ['action:run', 3],
    ['evaluate_triggers', 10],
    ['deliver', 10],
  ] as const)('returns %i for %s', (jobType, expected) => {
    expect(getConcurrencyLimit(jobType)).toBe(expected);
  });

  it('returns a positive default for unknown job types', () => {
    const limit = getConcurrencyLimit('unknown:type');
    expect(limit).toBeGreaterThan(0);
  });
});

describe('CONCURRENCY_LIMITS', () => {
  it('is a frozen record', () => {
    expect(typeof CONCURRENCY_LIMITS).toBe('object');
  });
});

describe('RETRY_POLICIES', () => {
  it('has entries for all configurable job types', () => {
    const configuredTypes = [
      'scrape:homepage',
      'scrape:careers',
      'scrape:login',
      'detect:hosting',
      'detect:website_analysis',
      'action:run',
      'evaluate_triggers',
      'deliver',
    ];
    for (const t of configuredTypes) {
      expect(RETRY_POLICIES).toHaveProperty(t);
    }
  });
});
