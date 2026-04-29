import { eq } from 'drizzle-orm';
import { getDb } from '@/db/connection';
import { triggers, type Trigger, type NewTrigger } from '@/db/schema';

export async function listTriggers(): Promise<Trigger[]> {
  const db = getDb();
  return db.query.triggers.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
}

export async function getTriggerById(id: string): Promise<Trigger | null> {
  const db = getDb();
  const result = await db.query.triggers.findFirst({
    where: eq(triggers.id, id),
  });
  return result ?? null;
}

export async function createTrigger(data: Omit<NewTrigger, 'id'>): Promise<Trigger> {
  const db = getDb();
  const [result] = await db.insert(triggers).values(data).returning();
  return result;
}

export async function updateTrigger(
  id: string,
  data: Partial<NewTrigger>,
): Promise<Trigger | null> {
  const db = getDb();
  const [result] = await db
    .update(triggers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(triggers.id, id))
    .returning();
  return result ?? null;
}

export async function deleteTrigger(id: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(triggers)
    .where(eq(triggers.id, id))
    .returning({ id: triggers.id });
  return result.length > 0;
}

export async function getActiveTriggers(): Promise<Trigger[]> {
  const db = getDb();
  return db.query.triggers.findMany({
    where: eq(triggers.isActive, true),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
}
