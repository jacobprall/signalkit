import { NextResponse } from 'next/server';
import {
  getTriggerById,
  updateTrigger,
  deleteTrigger,
} from '@/db/queries/triggers';
import { UpdateTriggerSchema } from '@/app/api/validation';
import { notFound, parseJson, withApi } from '@/app/api/with-api';

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const trigger = await getTriggerById(params.id);
  if (!trigger) notFound('Trigger not found');
  return NextResponse.json({ trigger });
});

export const PUT = withApi<{ id: string }>(async ({ request, params }) => {
  const data = await parseJson(request, UpdateTriggerSchema);
  const { is_active, match, action_type, action_config, conditions, ...rest } =
    data;

  const updateData: Record<string, unknown> = { ...rest };
  if (is_active !== undefined) updateData.isActive = is_active;
  if (action_type !== undefined) updateData.actionType = action_type;
  if (action_config !== undefined) updateData.actionConfig = action_config;
  if (conditions !== undefined) {
    // If the caller supplied new conditions but no match mode, retain
    // the existing trigger's match mode rather than silently defaulting
    // to 'all'.
    let resolvedMatch = match;
    if (resolvedMatch === undefined) {
      const current = await getTriggerById(params.id);
      resolvedMatch = (current?.conditions as { match?: 'all' | 'any' } | undefined)?.match ?? 'all';
    }
    updateData.conditions = { match: resolvedMatch, conditions };
  }

  const trigger = await updateTrigger(params.id, updateData);
  if (!trigger) notFound('Trigger not found');
  return NextResponse.json({ trigger });
});

export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const deleted = await deleteTrigger(params.id);
  if (!deleted) notFound('Trigger not found');
  return NextResponse.json({ success: true });
});
