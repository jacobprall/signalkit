'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { HOSTING_PROVIDERS } from '@/core/catalog';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { DataTable, type Column } from '../components/data-table';
import { FilterBar } from '../components/filter-bar';
import { SyncButton } from '../components/sync-button';

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  metadata: Record<string, unknown> | null;
  signals: Array<{
    signalType: string;
    value: Record<string, unknown>;
  }>;
}

// Hosting filter options are derived from the catalog so they always
// match what the DNS detector can actually identify.
const filters = [
  {
    key: 'hosting',
    label: 'Hosting',
    options: HOSTING_PROVIDERS.map((provider) => ({
      label: provider.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: provider,
    })),
  },
  {
    key: 'batch',
    label: 'YC Batch',
    options: [
      { label: 'W25', value: 'W25' },
      { label: 'S24', value: 'S24' },
      { label: 'W24', value: 'W24' },
      { label: 'S23', value: 'S23' },
      { label: 'W23', value: 'W23' },
    ],
  },
];

function getHosting(signals: CompanyRow['signals']): string | null {
  const hosting = signals.find((s) => s.signalType === 'hosting_detected');
  return (hosting?.value as Record<string, string>)?.provider ?? null;
}

function getOneLiner(meta: Record<string, unknown> | null): string {
  if (!meta) return '';
  return (meta.one_liner as string) ?? (meta.oneLiner as string) ?? '';
}

function getBatch(meta: Record<string, unknown> | null): string {
  if (!meta) return '';
  return (meta.batch as string) ?? '';
}

function getTeamSize(meta: Record<string, unknown> | null): number | null {
  if (!meta) return null;
  const size = meta.team_size ?? meta.teamSize;
  return typeof size === 'number' ? size : null;
}

export function CompaniesClient({
  companies,
  page,
  totalPages,
}: {
  companies: CompanyRow[];
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const columns: Column<CompanyRow>[] = [
    {
      key: 'name',
      header: 'Company',
      sortable: true,
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.name}</p>
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{getOneLiner(row.metadata)}</p>
        </div>
      ),
    },
    {
      key: 'batch',
      header: 'Batch',
      sortable: true,
      render: (row) => {
        const batch = getBatch(row.metadata);
        return batch ? <Badge label={batch} variant="batch" /> : <span className="text-slate-300">—</span>;
      },
      className: 'w-24',
    },
    {
      key: 'teamSize',
      header: 'Team',
      sortable: true,
      render: (row) => {
        const size = getTeamSize(row.metadata);
        return size !== null ? (
          <span className="text-sm text-slate-600">{size}</span>
        ) : (
          <span className="text-slate-300">—</span>
        );
      },
      className: 'w-20',
    },
    {
      key: 'hosting',
      header: 'Hosting',
      render: (row) => {
        const provider = getHosting(row.signals);
        return provider ? <Badge label={provider} variant="hosting" /> : <span className="text-slate-300">—</span>;
      },
      className: 'w-28',
    },
    {
      key: 'signals',
      header: 'Signals',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.signals.map((s) => (
            <Badge key={s.signalType} label={s.signalType.replace(/_/g, ' ')} variant="signal" />
          ))}
          {row.signals.length === 0 && <span className="text-slate-300">—</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/companies/${row.id}`);
            }}
          >
            View
          </Button>
          <SyncButton companyId={row.id} />
        </div>
      ),
      className: 'w-36 text-right',
    },
  ];

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} searchPlaceholder="Search companies..." />

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={companies}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => router.push(`/companies/${row.id}`)}
          emptyMessage="No companies found. Try adjusting your filters or sync new data."
        />
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
