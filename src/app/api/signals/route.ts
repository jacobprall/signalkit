import { NextResponse } from 'next/server';
import { eq, sql, and, type SQL } from 'drizzle-orm';
import { getDb } from '@/db/connection';
import { signals } from '@/db/schema';
import { SignalsQuerySchema } from '@/app/api/validation';
import { parseQuery, withApi } from '@/app/api/with-api';

export const GET = withApi(async ({ request }) => {
  const q = parseQuery(request, SignalsQuerySchema);

  const db = getDb();
  const conditions: SQL[] = [];
  if (q.companyId) conditions.push(eq(signals.companyId, q.companyId));
  if (q.signalType) conditions.push(eq(signals.signalType, q.signalType));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db.query.signals.findMany({
      where,
      limit: q.limit,
      offset: q.offset,
      orderBy: (s, { desc }) => [desc(s.detectedAt)],
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(signals)
      .where(where),
  ]);

  return NextResponse.json({
    signals: rows,
    total: countResult[0]?.count ?? 0,
    limit: q.limit,
    offset: q.offset,
  });
});
