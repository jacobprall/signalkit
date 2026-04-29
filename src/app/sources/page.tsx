import { SourcesClient } from './sources-client';
import { getLatestRunByCollector } from '@/db/queries/collection-runs';
import { PluginRegistry } from '@/core/plugin-registry';
import { createYCDirectoryCollector } from '@/collectors/yc-directory';

export const dynamic = 'force-dynamic';

function getRegistry(): PluginRegistry {
  const registry = new PluginRegistry();
  registry.register(createYCDirectoryCollector());
  return registry;
}

export default async function SourcesPage() {
  const registry = getRegistry();
  const collectors = registry.getAllCollectors();
  const latestRuns = await getLatestRunByCollector();

  const sources = collectors.map((c) => {
    const lastRun = latestRuns.get(c.name);
    return {
      name: c.name,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            startedAt: lastRun.startedAt?.toISOString() ?? null,
            completedAt: lastRun.completedAt?.toISOString() ?? null,
            stats: (lastRun.stats ?? {}) as Record<string, unknown>,
          }
        : null,
    };
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Data Sources</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage and trigger collection runs for each data source
        </p>
      </div>
      <SourcesClient sources={sources} />
    </div>
  );
}
