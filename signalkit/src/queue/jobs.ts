import type { JobPayload } from '../core/types';

export const JOB_TYPES = {
  COLLECT_YC: 'collect:yc_directory',
  SCRAPE_HOMEPAGE: 'scrape:homepage',
  SCRAPE_CAREERS: 'scrape:careers',
  SCRAPE_LOGIN: 'scrape:login',
  DETECT_HOSTING: 'detect:hosting',
  DETECT_WEBSITE: 'detect:website_analysis',
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

export const CONCURRENCY_LIMITS: Readonly<Partial<Record<JobType, number>>> = {
  'scrape:homepage': 5,
  'scrape:careers': 5,
  'scrape:login': 5,
  'detect:hosting': 20,
  'detect:website_analysis': 3,
  'action:run': 3,
  'evaluate_triggers': 10,
  'evaluate_triggers:fanout': 1,
  'deliver': 10,
};

export const RETRY_POLICIES: Readonly<Partial<Record<JobType, RetryPolicy>>> = {
  'scrape:homepage': { attempts: 2, backoff: { type: 'exponential', delay: 30000 } },
  'scrape:careers': { attempts: 2, backoff: { type: 'exponential', delay: 30000 } },
  'scrape:login': { attempts: 2, backoff: { type: 'exponential', delay: 30000 } },
  'detect:hosting': { attempts: 2, backoff: { type: 'exponential', delay: 10000 } },
  'detect:website_analysis': { attempts: 1, backoff: { type: 'fixed', delay: 60000 } },
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

export function getRetryPolicy(jobType: string): RetryPolicy {
  return RETRY_POLICIES[jobType as JobType] ?? DEFAULT_RETRY_POLICY;
}

export function getConcurrencyLimit(jobType: string): number {
  return CONCURRENCY_LIMITS[jobType as JobType] ?? DEFAULT_CONCURRENCY;
}
