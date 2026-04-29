import { PipelineClient } from './pipeline-client';
import { listRecentCollectionRuns } from '@/db/queries/collection-runs';
import { getQueueClient } from '@/queue/client';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const recentRuns = await listRecentCollectionRuns(20);

  let queue = { waiting: 0, active: 0, completed: 0, failed: 0 };
  try {
    const client = getQueueClient();
    queue = await client.getQueueStats();
  } catch {
    // Redis may not be available
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
        <p className="mt-1 text-sm text-slate-500">
          Monitor collection runs, job queue health, and recent failures
        </p>
      </div>
      <PipelineClient
        stats={{
          queue,
          recentRuns: recentRuns.map((r) => ({
            id: r.id,
            collectorType: r.collectorType,
            status: r.status,
            stats: (r.stats ?? {}) as Record<string, unknown>,
            startedAt: r.startedAt?.toISOString() ?? '',
            completedAt: r.completedAt?.toISOString() ?? null,
          })),
          recentFailures: [],
        }}
      />
    </div>
  );
}
