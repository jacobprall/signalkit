import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/connection';
import { companies } from '@/db/schema';
import { getCompanyDetail } from '@/db/queries/companies';
import { notFound, parseJson, withApi } from '@/app/api/with-api';

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const detail = await getCompanyDetail(params.id);
  if (!detail) notFound('Company not found');
  return NextResponse.json(detail);
});

const PatchCompanySchema = z.object({
  isArchived: z.boolean().optional(),
});

export const PATCH = withApi<{ id: string }>(async ({ request, params }) => {
  const body = await parseJson(request, PatchCompanySchema);
  const db = getDb();

  const existing = await db.query.companies.findFirst({
    where: eq(companies.id, params.id),
    columns: { id: true },
  });
  if (!existing) notFound('Company not found');

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.isArchived !== undefined) updates.isArchived = body.isArchived;

  const [updated] = await db
    .update(companies)
    .set(updates)
    .where(eq(companies.id, params.id))
    .returning({
      id: companies.id,
      isArchived: companies.isArchived,
      updatedAt: companies.updatedAt,
    });

  return NextResponse.json({ company: updated });
});
