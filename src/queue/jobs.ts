import type { JobPayload } from '../core/types';

export const JOB_TYPES = {
  COLLECT_YC: 'collect:yc_directory',
  ENRICH: 'enrich',
  DETECT_HOSTING: 'detect:hosting',
  DETECT_HIRING: 'detect:hiring_analysis',
  DETECT_PRODUCT: 'detect:product_analysis',
  DETECT_TECH_STACK: 'detect:tech_stack_analysis',
  EVALUATE_TRIGGERS: 'evaluate_triggers',
  EVALUATE_TRIGGERS_FANOUT: 'evaluate_triggers:fanout',
  ACTION_RUN: 'action:run',
  DELIVER: 'deliver',
} as const;

export type JobType = JobPayload['type'];

interface RetryPolicy {
  readonly attempts: number;
  readonly backoff: {
    readonly type: 'exponential' | 'fixed';
    readonly delay: number;
  };
}

const CONCURRENCY_LIMITS: Record<string, number> = {
  'enrich': 5,
  'detect:hosting': 20,
  'action:run': 3,
  'evaluate_triggers': 10,
  'evaluate_triggers:fanout': 1,
  'deliver': 10,
};

const RETRY_POLICIES: Record<string, RetryPolicy> = {
  'enrich': { attempts: 2, backoff: { type: 'exponential', delay: 30000 } },
  'detect:hosting': { attempts: 2, backoff: { type: 'exponential', delay: 10000 } },
  'action:run': { attempts: 1, backoff: { type: 'fixed', delay: 60000 } },
  'evaluate_triggers': { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
  'evaluate_triggers:fanout': { attempts: 1, backoff: { type: 'fixed', delay: 60000 } },
  'deliver': { attempts: 3, backoff: { type: 'exponential', delay: 30000 } },
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 2,
  backoff: { type: 'exponential', delay: 10000 },
};

const DEFAULT_CONCURRENCY = 5;

const AI_DETECTOR_CONCURRENCY = 3;
const AI_DETECTOR_RETRY: RetryPolicy = { attempts: 1, backoff: { type: 'fixed', delay: 60000 } };

export function getRetryPolicy(jobType: string): RetryPolicy {
  if (jobType.startsWith('detect:') && !RETRY_POLICIES[jobType]) {
    return AI_DETECTOR_RETRY;
  }
  return RETRY_POLICIES[jobType] ?? DEFAULT_RETRY_POLICY;
}

export function getConcurrencyLimit(jobType: string): number {
  if (jobType.startsWith('detect:') && !CONCURRENCY_LIMITS[jobType]) {
    return AI_DETECTOR_CONCURRENCY;
  }
  return CONCURRENCY_LIMITS[jobType] ?? DEFAULT_CONCURRENCY;
}
