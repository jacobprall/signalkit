import { describe, it, expect, beforeEach } from 'vitest';
import type {
  IQueueClient,
  QueueStats,
  EnqueueOptions,
  BatchEnqueueOptions,
} from '@/queue/client';
import type { JobPayload } from '@/core/types';

class MockQueueClient implements IQueueClient {
  private readonly jobs: Map<string, JobPayload> = new Map();
  private jobCounter = 0;

  async enqueue(payload: JobPayload, _options?: EnqueueOptions): Promise<string> {
    const id = `job_${++this.jobCounter}`;
    this.jobs.set(id, payload);
    return id;
  }

  async enqueueBatch(payloads: readonly JobPayload[], options?: BatchEnqueueOptions): Promise<string[]> {
    const ids: string[] = [];
    for (const payload of payloads) {
      const id = await this.enqueue(payload);
      ids.push(id);
    }
    return ids;
  }

  async getQueueStats(): Promise<QueueStats> {
    return {
      waiting: this.jobs.size,
      active: 0,
      completed: 0,
      failed: 0,
    };
  }

  async close(): Promise<void> {
    this.jobs.clear();
  }
}

describe('IQueueClient contract (MockQueueClient)', () => {
  let client: IQueueClient;

  beforeEach(() => {
    client = new MockQueueClient();
  });

  describe('enqueue', () => {
    it('returns a string job ID', async () => {
      const payload: JobPayload = { type: 'evaluate_triggers', companyId: 'co_1' };
      const id = await client.enqueue(payload);

      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns unique IDs for different enqueues', async () => {
      const payload: JobPayload = { type: 'evaluate_triggers', companyId: 'co_1' };
      const id1 = await client.enqueue(payload);
      const id2 = await client.enqueue(payload);

      expect(id1).not.toBe(id2);
    });

    it('accepts optional delay and priority options', async () => {
      const payload: JobPayload = {
        type: 'deliver',
        actionRunId: 'ar_1',
        deliveryType: 'slack',
        deliveryConfig: {},
      };
      const id = await client.enqueue(payload, { delay: 5000, priority: 1 });

      expect(typeof id).toBe('string');
    });
  });

  describe('enqueueBatch', () => {
    it('returns an array of string job IDs', async () => {
      const payloads: JobPayload[] = [
        { type: 'evaluate_triggers', companyId: 'co_1' },
        { type: 'evaluate_triggers', companyId: 'co_2' },
        {
          type: 'deliver',
          actionRunId: 'ar_1',
          deliveryType: 'slack',
          deliveryConfig: {},
        },
      ];

      const ids = await client.enqueueBatch(payloads);

      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toHaveLength(3);
      for (const id of ids) {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      }
    });

    it('returns unique IDs for each job in the batch', async () => {
      const payloads: JobPayload[] = [
        { type: 'evaluate_triggers', companyId: 'co_1' },
        { type: 'evaluate_triggers', companyId: 'co_2' },
      ];

      const ids = await client.enqueueBatch(payloads);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('returns empty array for empty input', async () => {
      const ids = await client.enqueueBatch([]);
      expect(ids).toEqual([]);
    });
  });

  describe('getQueueStats', () => {
    it('returns an object with the expected shape', async () => {
      const stats = await client.getQueueStats();

      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });

    it('all stats are non-negative', async () => {
      const stats = await client.getQueueStats();

      expect(stats.waiting).toBeGreaterThanOrEqual(0);
      expect(stats.active).toBeGreaterThanOrEqual(0);
      expect(stats.completed).toBeGreaterThanOrEqual(0);
      expect(stats.failed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('close', () => {
    it('resolves without error', async () => {
      await expect(client.close()).resolves.toBeUndefined();
    });
  });
});
