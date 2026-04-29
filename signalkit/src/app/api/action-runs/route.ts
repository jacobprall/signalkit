import { NextResponse } from 'next/server';
import { ActionRunRepository } from '@/db/queries/action-runs';
import { ActionRunsQuerySchema } from '@/app/api/validation';
import { parseQuery, withApi } from '@/app/api/with-api';

export const GET = withApi(async ({ request }) => {
  const q = parseQuery(request, ActionRunsQuerySchema);
  const repo = new ActionRunRepository();
  const rows = await repo.list({
    companyId: q.companyId,
    actionType: q.actionType,
    status: q.status,
    limit: q.limit,
  });
  return NextResponse.json({ actionRuns: rows });
});
