import { NextResponse } from 'next/server';
import { withApi } from '@/app/api/with-api';

export const POST = withApi(async () => {
  const { getQueueClient } = await import('@/queue/client');
  const queue = getQueueClient();
  const jobId = await queue.enqueue({ type: 'collect:yc_directory' });
  return NextResponse.json({ jobId, message: 'Sync started' });
});
