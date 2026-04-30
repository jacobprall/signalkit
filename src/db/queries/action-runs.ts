import { and, eq, sql, type SQL } from 'drizzle-orm';
import { getDb, type Database } from '@/db/connection';
import { actionRuns, type ActionRun } from '@/db/schema';

export type ActionRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface CreateActionRunInput {
  triggerId: string | null;
  companyId: string;
  signalIds: string[];
  actionType: string;
  input?: Record<string, unknown>;
  chainId?: string;
  stepIndex?: number;
}

export interface ActionRunFilter {
  companyId?: string;
  actionType?: string;
  status?: ActionRunStatus;
  limit?: number;
}

export interface IActionRunRepository {
  create(input: CreateActionRunInput): Promise<ActionRun>;
  markRunning(id: string): Promise<void>;
  markCompleted(id: string, output: Record<string, unknown>): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  findById(id: string): Promise<ActionRun | null>;
  list(filter: ActionRunFilter): Promise<ActionRun[]>;
}

export class ActionRunRepository implements IActionRunRepository {
  constructor(private readonly db: Database = getDb()) {}

  async create(input: CreateActionRunInput): Promise<ActionRun> {
    const [row] = await this.db
      .insert(actionRuns)
      .values({
        triggerId: input.triggerId,
        companyId: input.companyId,
        signalIds: input.signalIds,
        actionType: input.actionType,
        status: 'pending',
        input: input.input ?? {},
        chainId: input.chainId ?? null,
        stepIndex: input.stepIndex ?? null,
      })
      .returning();
    return row;
  }

  async markRunning(id: string): Promise<void> {
    await this.db
      .update(actionRuns)
      .set({ status: 'running' })
      .where(eq(actionRuns.id, id));
  }

  async markCompleted(
    id: string,
    output: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .update(actionRuns)
      .set({ status: 'completed', output, completedAt: new Date() })
      .where(eq(actionRuns.id, id));
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db
      .update(actionRuns)
      .set({ status: 'failed', error, completedAt: new Date() })
      .where(eq(actionRuns.id, id));
  }

  async findById(id: string): Promise<ActionRun | null> {
    const row = await this.db.query.actionRuns.findFirst({
      where: eq(actionRuns.id, id),
    });
    return row ?? null;
  }

  async list(filter: ActionRunFilter): Promise<ActionRun[]> {
    const where: SQL[] = [];
    if (filter.companyId) where.push(eq(actionRuns.companyId, filter.companyId));
    if (filter.actionType) where.push(eq(actionRuns.actionType, filter.actionType));
    if (filter.status) where.push(eq(actionRuns.status, filter.status));

    return this.db.query.actionRuns.findMany({
      where: where.length ? and(...where) : undefined,
      limit: filter.limit ?? 50,
      orderBy: (ar, { desc }) => [desc(ar.createdAt)],
    });
  }
}

export async function getActionRunCounts(
  database?: Database,
): Promise<Record<ActionRunStatus, number>> {
  const db = database ?? getDb();
  const rows = await db
    .select({
      status: actionRuns.status,
      count: sql<number>`count(*)::int`,
    })
    .from(actionRuns)
    .groupBy(actionRuns.status);

  const counts: Record<ActionRunStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };
  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status as ActionRunStatus] = row.count;
    }
  }
  return counts;
}
