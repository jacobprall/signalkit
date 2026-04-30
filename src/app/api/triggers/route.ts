import { NextResponse } from 'next/server';
import { listTriggers, createTrigger } from '@/db/queries/triggers';
import { CreateTriggerSchema } from '@/app/api/validation';
import { parseJson, withApi } from '@/app/api/with-api';

export const GET = withApi(async () => {
  const triggers = await listTriggers();
  return NextResponse.json({ triggers });
});

export const POST = withApi(async ({ request }) => {
  const data = await parseJson(request, CreateTriggerSchema);
  const { match, action_type, action_config, actions, conditions, ...rest } = data;

  const trigger = await createTrigger({
    ...rest,
    conditions: { match, conditions },
    // For chains, actionType still needs a value for the NOT NULL DB constraint; use the first step's type.
    actionType: action_type ?? actions![0].action_type,
    actionConfig: action_config,
    actions: actions ?? null,
  });

  return NextResponse.json({ trigger }, { status: 201 });
});
