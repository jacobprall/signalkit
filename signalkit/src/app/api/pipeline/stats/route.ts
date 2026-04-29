import { NextResponse } from 'next/server';
import { listRecentCollectionRuns } from '@/db/queries/collection-runs';
import { withApi } from '@/app/api/with-api';

export const GET = withApi(async () => {
  const recentRuns = await listRecentCollectionRuns(10);

  let queueStats = { waiting: 0, active: 0, completed: 0, failed: 0 };
  try {
    const { getQueueClient } = await import('@/queue/client');
    queueStats = await getQueueClient().getQueueStats();
  } catch {
    // Redis unavailable — return zeroed stats so the page still loads.
  }

  return NextResponse.json({
    collectionRuns: recentRuns,
    queue: queueStats,
    recentFailures: recentRuns.filter((r) => r.status === 'failed'),
  });
});
