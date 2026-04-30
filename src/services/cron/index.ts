import 'dotenv/config';
import { QueueClient } from '../../queue/client';
import { closeDb } from '../../db/connection';
import { createLogger } from '@/lib/logger';

const log = createLogger('cron');

async function run(): Promise<void> {
  log.info('starting scheduled run');

  const queue = new QueueClient();
  try {
    const ycJobId = await queue.enqueue({ type: 'collect:yc_directory' });
    log.info({ jobId: ycJobId }, 'enqueued collect:yc_directory');

    const fanoutId = await queue.enqueue({ type: 'evaluate_triggers:fanout' });
    log.info({ jobId: fanoutId }, 'enqueued evaluate_triggers:fanout');
  } finally {
    await queue.close();
    await closeDb();
  }

  log.info('scheduled run complete');
}

run().catch((err) => {
  log.fatal({ err }, 'cron failed');
  process.exit(1);
});
