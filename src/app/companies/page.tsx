import { SyncButton } from '../components/sync-button';
import { CompaniesClient } from './companies-client';
import { listCompanies, type CompanyFilters } from '@/db/queries/companies';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const resolved = await searchParams;

  const toArray = (v: string | string[] | undefined): string[] => {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  };

  const rawPage = Number.parseInt(String(resolved.page ?? '1'), 10);
  const pageNum = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = 25;

  const parseIntParam = (v: string | string[] | undefined): number | undefined => {
    const raw = Array.isArray(v) ? v[0] : v;
    if (!raw) return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const filters: CompanyFilters = {
    hostingProvider: toArray(resolved.hosting),
    batch: toArray(resolved.batch),
    industry: toArray(resolved.industry),
    hasSignalType: toArray(resolved.signalType),
    search: typeof resolved.q === 'string' ? resolved.q : undefined,
    teamSizeMin: parseIntParam(resolved.teamSizeMin),
    teamSizeMax: parseIntParam(resolved.teamSizeMax),
    limit: pageSize,
    offset: (pageNum - 1) * pageSize,
  };

  const { companies, total } = await listCompanies(filters);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rows = companies.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    domain: c.domain,
    metadata: c.source_data ?? c.metadata,
    signals: c.signals.map((s) => ({
      signalType: s.signal_type,
      value: s.value,
    })),
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Companies</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} {total === 1 ? 'company' : 'companies'} tracked
          </p>
        </div>
        <SyncButton label="Sync All" size="md" />
      </div>

      <CompaniesClient
        companies={rows}
        page={pageNum}
        totalPages={totalPages}
      />
    </div>
  );
}
