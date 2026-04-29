import { NextResponse } from 'next/server';
import { withApi, notFound } from '@/app/api/with-api';
import { PluginRegistry } from '@/core/plugin-registry';
import { createYCDirectoryCollector } from '@/collectors/yc-directory';

function getRegistry(): PluginRegistry {
  const registry = new PluginRegistry();
  registry.register(createYCDirectoryCollector());
  return registry;
}

export const POST = withApi<{ name: string }>(async ({ params }) => {
  const registry = getRegistry();
  const collector = registry.getCollector(params.name);
  if (!collector) {
    notFound(`Collector not found: ${params.name}`);
  }

  const { getQueueClient } = await import('@/queue/client');
  const queue = getQueueClient();
  const jobId = await queue.enqueue({ type: `collect:${collector.name}` as any });

  return NextResponse.json({
    jobId,
    collector: collector.name,
    message: `Collection started for ${collector.name}`,
  });
});
