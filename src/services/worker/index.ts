import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { bootstrap } from '../bootstrap';
import { getConcurrencyLimit } from '../../queue/jobs';
import type { JobPayload } from '../../core/types';
import { createLogger } from '@/lib/logger';

const log = createLogger('worker');
const QUEUE_NAME = 'signalkit';

async function main() {
  const system = bootstrap();
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const concurrency = Math.max(
    ...['enrich', 'detect:hosting', 'detect:hiring_analysis', 'detect:product_analysis', 'detect:tech_stack_analysis', 'action:run', 'evaluate_triggers', 'deliver'].map(
      getConcurrencyLimit,
    ),
  );

  const worker = new Worker<JobPayload>(
    QUEUE_NAME,
    async (job: Job<JobPayload>) => {
      log.info({ jobType: job.data.type, jobId: job.id }, 'processing job');
      await system.dispatcher.dispatch(job.data);
      log.info({ jobType: job.data.type, jobId: job.id }, 'completed job');
    },
    { connection, concurrency },
  );

  worker.on('failed', (job, err) => {
    log.error({ jobType: job?.data.type, jobId: job?.id, err }, 'job failed');
  });

  worker.on('error', (err) => {
    log.error({ err }, 'worker error');
  });

  log.info({ queue: QUEUE_NAME, concurrency }, 'worker listening');

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down');
    try {
      await worker.close();
      await connection.quit();
      await system.shutdown();
    } catch (err) {
      log.error({ err }, 'shutdown error');
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  log.fatal({ err }, 'failed to start');
  process.exit(1);
});
