import 'dotenv/config';
import { QueueClient } from '../../queue/client';
import { closeDb } from '../../db/connection';

// Cron entry point. Today it kicks off two independent flows:
//   1. A YC re-collection (refreshes the company list and re-fans out
//      scrape + DNS jobs for new/changed companies).
//   2. A trigger-evaluation fanout for every existing company so triggers
//      with `evaluation: 'weekly'` get a chance to fire.
async function run(): Promise<void> {
  console.log('[cron] starting scheduled run');

  const queue = new QueueClient();
  try {
    const ycJobId = await queue.enqueue({ type: 'collect:yc_directory' });
    console.log(`[cron] enqueued collect:yc_directory [${ycJobId}]`);

    const fanoutId = await queue.enqueue({ type: 'evaluate_triggers:fanout' });
    console.log(`[cron] enqueued evaluate_triggers:fanout [${fanoutId}]`);
  } finally {
    await queue.close();
    await closeDb();
  }

  console.log('[cron] done');
}

run().catch((err) => {
  console.error('[cron] failed:', err);
  process.exit(1);
});
