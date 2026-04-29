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
  const { match, action_type, action_config, conditions, ...rest } = data;

  const trigger = await createTrigger({
    ...rest,
    conditions: { match, conditions },
    actionType: action_type,
    actionConfig: action_config,
  });

  return NextResponse.json({ trigger }, { status: 201 });
});
