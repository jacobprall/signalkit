import { ActionsClient } from './actions-client';
import { getDb } from '@/db/connection';
import { actionRuns, companies } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

// Always render at request time — this page reads live data and would
// otherwise fail at build time when DATABASE_URL points to a stub.
export const dynamic = 'force-dynamic';

export default async function ActionsPage() {
  const db = getDb();

  const runs = await db
    .select({
      id: actionRuns.id,
      actionType: actionRuns.actionType,
      status: actionRuns.status,
      companyId: actionRuns.companyId,
      output: actionRuns.output,
      createdAt: actionRuns.createdAt,
      companyName: companies.name,
    })
    .from(actionRuns)
    .leftJoin(companies, eq(actionRuns.companyId, companies.id))
    .orderBy(desc(actionRuns.createdAt))
    .limit(50);

  const rows = runs.map((r) => ({
    id: r.id,
    actionType: r.actionType,
    status: r.status,
    companyId: r.companyId,
    companyName: r.companyName ?? undefined,
    output: r.output as Record<string, unknown> | null,
    createdAt: r.createdAt?.toISOString() ?? '',
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">AI Outputs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Browse AI-generated briefs, outreach drafts, and analyses
        </p>
      </div>
      <ActionsClient actionRuns={rows} />
    </div>
  );
}
