import { NextResponse } from 'next/server';
import { ActionRunRepository } from '@/db/queries/action-runs';
import { getCompanyById } from '@/db/queries/companies';
import { TriggerActionSchema } from '@/app/api/validation';
import { notFound, parseJson, withApi } from '@/app/api/with-api';

// Manual / one-off action trigger. We do NOT call the AI inline — that
// could take 10–60s and would block the request thread. Instead we
// insert a `pending` action_run, enqueue an `action:run` job, and
// return the id so the client can poll.
export const POST = withApi<{ id: string }>(async ({ request, params }) => {
  const body = await parseJson(request, TriggerActionSchema);

  const company = await getCompanyById(params.id);
  if (!company) notFound('Company not found');

  const repo = new ActionRunRepository();
  const run = await repo.create({
    triggerId: null,
    companyId: params.id,
    signalIds: [],
    actionType: body.actionType,
    input: body.config,
  });

  const { getQueueClient } = await import('@/queue/client');
  const queue = getQueueClient();
  const jobId = await queue.enqueue({
    type: 'action:run',
    actionRunId: run.id,
    triggerId: null,
    companyId: params.id,
    signalIds: [],
    actionType: body.actionType,
    config: body.config,
    deliveries: body.deliveries,
  });

  return NextResponse.json(
    {
      actionRun: {
        id: run.id,
        status: run.status,
        actionType: run.actionType,
        createdAt: run.createdAt,
      },
      jobId,
    },
    { status: 202 },
  );
});
