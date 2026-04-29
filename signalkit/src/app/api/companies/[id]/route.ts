import { NextResponse } from 'next/server';
import { getCompanyDetail } from '@/db/queries/companies';
import { notFound, withApi } from '@/app/api/with-api';

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const detail = await getCompanyDetail(params.id);
  if (!detail) notFound('Company not found');
  return NextResponse.json(detail);
});
