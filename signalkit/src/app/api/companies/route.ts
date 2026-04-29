import { NextResponse } from 'next/server';
import { listCompanies, type CompanyFilters } from '@/db/queries/companies';
import { CompaniesQuerySchema } from '@/app/api/validation';
import { parseQuery, withApi } from '@/app/api/with-api';

export const GET = withApi(async ({ request }) => {
  const q = parseQuery(request, CompaniesQuerySchema);

  const filters: CompanyFilters = {
    hostingProvider: q.hosting,
    batch: q.batch,
    industry: q.industry,
    hasSignalType: q.signalType,
    search: q.q ?? q.search,
    teamSizeMin: q.teamSizeMin,
    teamSizeMax: q.teamSizeMax,
    limit: q.limit,
    offset: q.offset,
  };

  const result = await listCompanies(filters);

  return NextResponse.json({
    companies: result.companies,
    total: result.total,
    limit: filters.limit,
    offset: filters.offset,
  });
});
