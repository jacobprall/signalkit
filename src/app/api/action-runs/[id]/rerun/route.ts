import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ActionRunRepository } from '@/db/queries/action-runs';
import { notFound, parseJson, withApi } from '@/app/api/with-api';

const RerunSchema = z.object({
  configOverrides: z.record(z.string(), z.unknown()).optional(),
});

export const POST = withApi<{ id: string }>(async ({ request, params }) => {
  const repo = new ActionRunRepository();
  const original = await repo.findById(params.id);
  if (!original) notFound('Action run not found');

  const contentType = request.headers.get('content-type') ?? '';
  const hasBody = contentType.includes('application/json');
  const { configOverrides } = hasBody
    ? await parseJson(request, RerunSchema)
    : { configOverrides: undefined };

  const mergedConfig = {
    ...((original.input as Record<string, unknown>) ?? {}),
    ...(configOverrides ?? {}),
  };

  const run = await repo.create({
    triggerId: original.triggerId,
    companyId: original.companyId,
    signalIds: (original.signalIds as string[]) ?? [],
    actionType: original.actionType,
    input: mergedConfig,
  });

  const { getQueueClient } = await import('@/queue/client');
  const queue = getQueueClient();
  const jobId = await queue.enqueue({
    type: 'action:run',
    actionRunId: run.id,
    triggerId: original.triggerId,
    companyId: original.companyId,
    signalIds: (original.signalIds as string[]) ?? [],
    actionType: original.actionType,
    config: mergedConfig,
    deliveries: [{ type: 'dashboard', config: {} }],
  });

  return NextResponse.json(
    {
      actionRun: {
        id: run.id,
        status: run.status,
        actionType: run.actionType,
        createdAt: run.createdAt,
      },
      originalRunId: original.id,
      jobId,
    },
    { status: 202 },
  );
});
