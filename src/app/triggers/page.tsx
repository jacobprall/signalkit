import { TriggersClient } from './triggers-client';
import { listTriggers } from '@/db/queries/triggers';

export const dynamic = 'force-dynamic';

export default async function TriggersPage() {
  const triggers = await listTriggers();

  const rows = triggers.map((t) => ({
    id: t.id,
    name: t.name,
    conditions: t.conditions as { match: string; conditions: Array<{ signal_type: string; field?: string; operator: string; value?: string }> },
    actionType: t.actionType,
    isActive: t.isActive ?? true,
    createdAt: t.createdAt?.toISOString() ?? '',
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Triggers</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure when AI actions fire based on signal conditions
        </p>
      </div>
      <TriggersClient triggers={rows} />
    </div>
  );
}
