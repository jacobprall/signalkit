import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { bootstrap } from '../bootstrap';
import { getConcurrencyLimit } from '../../queue/jobs';
import type { JobPayload } from '../../core/types';

const QUEUE_NAME = 'signalkit';

async function main() {
  const system = bootstrap();
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  // BullMQ supports a single concurrency setting per Worker. We use the
  // most permissive limit across our job types so we don't bottleneck;
  // BullMQ rate-limits at the queue level if needed.
  const concurrency = Math.max(
    ...['enrich', 'detect:hosting', 'detect:website_analysis', 'action:run', 'evaluate_triggers', 'deliver'].map(
      getConcurrencyLimit,
    ),
  );

  const worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job: Job<JobPayload>) => {
      console.log(`[worker] processing ${job.data.type} [${job.id}]`);
      await system.dispatcher.dispatch(job.data);
      console.log(`[worker] completed ${job.data.type} [${job.id}]`);
    },
    { connection, concurrency },
  );

  worker.on('failed', (job, err) => {
    console.error(`[worker] failed ${job?.data.type} [${job?.id}]`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[worker] error:', err.message);
  });

  console.log(`[worker] listening on queue "${QUEUE_NAME}" (concurrency=${concurrency})`);

  const shutdown = async (signal: string) => {
    console.log(`[worker] received ${signal}, shutting down...`);
    try {
      await worker.close();
      await connection.quit();
      await system.shutdown();
    } catch (err) {
      console.error('[worker] shutdown error:', err);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] failed to start:', err);
  process.exit(1);
});
