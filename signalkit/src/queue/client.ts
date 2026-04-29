import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { JobPayload } from '../core/types';
import { getRetryPolicy } from './jobs';

const QUEUE_NAME = 'signalkit';

export interface QueueStats {
  readonly waiting: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
}

export interface EnqueueOptions {
  readonly delay?: number;
  readonly priority?: number;
}

export interface BatchEnqueueOptions {
  readonly delayBetween?: number;
}

export interface IQueueClient {
  enqueue(payload: JobPayload, options?: EnqueueOptions): Promise<string>;
  enqueueBatch(payloads: readonly JobPayload[], options?: BatchEnqueueOptions): Promise<string[]>;
  getQueueStats(): Promise<QueueStats>;
  close(): Promise<void>;
}

export class QueueClient implements IQueueClient {
  private readonly queue: Queue;
  private readonly connection: IORedis;

  constructor(redisUrl?: string) {
    const url = redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.connection = new IORedis(url, { maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
  }

  async enqueue(payload: JobPayload, options?: EnqueueOptions): Promise<string> {
    const retryPolicy = getRetryPolicy(payload.type);
    const job = await this.queue.add(payload.type, payload, {
      delay: options?.delay,
      priority: options?.priority,
      attempts: retryPolicy.attempts,
      backoff: retryPolicy.backoff,
    });
    return job.id!;
  }

  async enqueueBatch(
    payloads: readonly JobPayload[],
    options?: BatchEnqueueOptions,
  ): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < payloads.length; i++) {
      const delay = options?.delayBetween ? i * options.delayBetween : undefined;
      const id = await this.enqueue(payloads[i], { delay });
      ids.push(id);
    }
    return ids;
  }

  async getQueueStats(): Promise<QueueStats> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}

let instance: QueueClient | null = null;

export function getQueueClient(redisUrl?: string): QueueClient {
  if (!instance) {
    instance = new QueueClient(redisUrl);
  }
  return instance;
}
