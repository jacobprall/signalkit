import { eq } from 'drizzle-orm';
import { getDb } from '@/db/connection';
import { collectionRuns, type CollectionRun } from '@/db/schema';

export async function createCollectionRun(collectorType: string): Promise<string> {
  const db = getDb();
  const [result] = await db
    .insert(collectionRuns)
    .values({ collectorType, status: 'running' })
    .returning({ id: collectionRuns.id });
  return result.id;
}

export async function completeCollectionRun(
  id: string,
  stats: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  await db
    .update(collectionRuns)
    .set({ status: 'completed', stats, completedAt: new Date() })
    .where(eq(collectionRuns.id, id));
}

export async function failCollectionRun(id: string, error: string): Promise<void> {
  const db = getDb();
  await db
    .update(collectionRuns)
    .set({ status: 'failed', stats: { error }, completedAt: new Date() })
    .where(eq(collectionRuns.id, id));
}

export async function listRecentCollectionRuns(limit = 20): Promise<CollectionRun[]> {
  const db = getDb();
  return db.query.collectionRuns.findMany({
    limit,
    orderBy: (cr, { desc }) => [desc(cr.startedAt)],
  });
}
