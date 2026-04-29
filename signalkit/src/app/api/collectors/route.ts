import { NextResponse } from 'next/server';
import { withApi } from '@/app/api/with-api';
import { getLatestRunByCollector } from '@/db/queries/collection-runs';
import { PluginRegistry } from '@/core/plugin-registry';
import { createYCDirectoryCollector } from '@/collectors/yc-directory';

function getRegistry(): PluginRegistry {
  const registry = new PluginRegistry();
  registry.register(createYCDirectoryCollector());
  return registry;
}

export const GET = withApi(async () => {
  const registry = getRegistry();
  const collectors = registry.getAllCollectors();
  const latestRuns = await getLatestRunByCollector();

  const results = collectors.map((c) => {
    const lastRun = latestRuns.get(c.name);
    return {
      name: c.name,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            startedAt: lastRun.startedAt?.toISOString() ?? null,
            completedAt: lastRun.completedAt?.toISOString() ?? null,
            stats: lastRun.stats ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({ collectors: results });
});
