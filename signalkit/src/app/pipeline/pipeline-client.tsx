'use client';

import { Badge } from '../components/badge';
import { Card } from '../components/card';

interface PipelineStats {
  queue: { waiting: number; active: number; completed: number; failed: number };
  recentRuns: Array<{
    id: string;
    collectorType: string;
    status: string;
    stats: Record<string, unknown>;
    startedAt: string;
    completedAt: string | null;
  }>;
  recentFailures: Array<{
    id: string;
    actionType: string;
    status: string;
    error: string | null;
    createdAt: string;
    companyId: string;
  }>;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export function PipelineClient({ stats }: { stats: PipelineStats }) {
  return (
    <div className="space-y-8">
      {/* Queue Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Waiting" value={stats.queue.waiting} color="text-amber-600" />
        <StatCard label="Active" value={stats.queue.active} color="text-indigo-600" />
        <StatCard label="Completed" value={stats.queue.completed} color="text-emerald-600" />
        <StatCard label="Failed" value={stats.queue.failed} color="text-rose-600" />
      </div>

      {/* Collection Runs */}
      <Card title="Recent Collection Runs">
        {stats.recentRuns.length === 0 ? (
          <p className="text-sm text-slate-400">No collection runs yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Type</th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Status</th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Started</th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Stats</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="py-2 font-medium text-slate-700">{run.collectorType}</td>
                    <td className="py-2"><Badge label={run.status} variant="status" /></td>
                    <td className="py-2 text-xs text-slate-500">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {Object.entries(run.stats as Record<string, unknown>)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent Failures */}
      <Card title="Recent Failures">
        {stats.recentFailures.length === 0 ? (
          <p className="text-sm text-slate-400">No recent failures</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Action</th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Error</th>
                  <th className="pb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentFailures.map((fail) => (
                  <tr key={fail.id}>
                    <td className="py-2">
                      <Badge label={fail.actionType.replace(/_/g, ' ')} variant="signal" />
                    </td>
                    <td className="py-2 max-w-sm truncate text-xs text-rose-600">
                      {fail.error ?? 'Unknown error'}
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {new Date(fail.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
