'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { HOSTING_PROVIDERS } from '@/core/catalog';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { DataTable } from '../components/data-table';
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

const columns: ColumnDef<CompanyRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Company',
    enableSorting: true,
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-slate-900">{row.original.name}</p>
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{getOneLiner(row.original.metadata)}</p>
      </div>
    ),
  },
  {
    id: 'batch',
    accessorFn: (row) => getBatch(row.metadata),
    header: 'Batch',
    enableSorting: true,
    size: 96,
    cell: ({ row }) => {
      const batch = getBatch(row.original.metadata);
      return batch ? <Badge label={batch} variant="batch" /> : <span className="text-slate-300">—</span>;
    },
  },
  {
    id: 'teamSize',
    accessorFn: (row) => getTeamSize(row.metadata),
    header: 'Team',
    enableSorting: true,
    size: 80,
    cell: ({ row }) => {
      const size = getTeamSize(row.original.metadata);
      return size !== null ? (
        <span className="text-sm text-slate-600">{size}</span>
      ) : (
        <span className="text-slate-300">—</span>
      );
    },
  },
  {
    id: 'hosting',
    accessorFn: (row) => getHosting(row.signals),
    header: 'Hosting',
    enableSorting: false,
    size: 112,
    cell: ({ row }) => {
      const provider = getHosting(row.original.signals);
      return provider ? <Badge label={provider} variant="hosting" /> : <span className="text-slate-300">—</span>;
    },
  },
  {
    id: 'signals',
    header: 'Signals',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.signals.map((s) => (
          <Badge key={s.signalType} label={s.signalType.replace(/_/g, ' ')} variant="signal" />
        ))}
        {row.original.signals.length === 0 && <span className="text-slate-300">—</span>}
      </div>
    ),
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    size: 144,
    meta: { className: 'text-right' },
    cell: function ActionsCell({ row }) {
      const router = useRouter();
      return (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/companies/${row.original.id}`);
            }}
          >
            View
          </Button>
          <SyncButton companyId={row.original.id} />
        </div>
      );
    },
  },
];

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
