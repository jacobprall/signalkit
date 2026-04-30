'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { type ColumnDef, type RowSelectionState } from '@tanstack/react-table';
import { HOSTING_PROVIDERS, SIGNAL_TYPES } from '@/core/catalog';
import { Badge } from '../components/badge';
import { Button } from '../components/button';
import { DataTable } from '../components/data-table';
import { FilterBar } from '../components/filter-bar';
import { SyncButton } from '../components/sync-button';
import { AddCompanyModal } from '../components/add-company-modal';
import { useToast } from '../components/toast';

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
  {
    key: 'signalType',
    label: 'Signal',
    options: SIGNAL_TYPES.map((st) => ({
      label: st.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: st,
    })),
  },
];

// ---------------------------------------------------------------------------
// Saved filter presets (localStorage)
// ---------------------------------------------------------------------------

const PRESETS_STORAGE_KEY = 'signalkit:saved-filters';

interface SavedPreset {
  id: string;
  name: string;
  params: string; // serialized URLSearchParams
}

function loadPresets(): SavedPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistPresets(presets: SavedPreset[]) {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

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

function Checkbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate ?? false;
      }}
      onChange={onChange}
      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
    />
  );
}

const selectColumn: ColumnDef<CompanyRow, unknown> = {
  id: 'select',
  size: 40,
  enableSorting: false,
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected()}
      onChange={table.getToggleAllPageRowsSelectedHandler()}
    />
  ),
  cell: ({ row }) => (
    <span onClick={(e) => e.stopPropagation()}>
      <Checkbox
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    </span>
  ),
};

const columns: ColumnDef<CompanyRow, unknown>[] = [
  selectColumn,
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

function TeamSizeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentMin = searchParams.get('teamSizeMin') ?? '';
  const currentMax = searchParams.get('teamSizeMax') ?? '';
  const [min, setMin] = useState(currentMin);
  const [max, setMax] = useState(currentMax);

  useEffect(() => {
    setMin(searchParams.get('teamSizeMin') ?? '');
    setMax(searchParams.get('teamSizeMax') ?? '');
  }, [searchParams]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    if (min) params.set('teamSizeMin', min);
    else params.delete('teamSizeMin');
    if (max) params.set('teamSizeMax', max);
    else params.delete('teamSizeMax');
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  const hasValue = !!(currentMin || currentMax);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
      >
        Team Size
        {hasValue && (
          <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-xs text-white">
            {currentMin || '0'}–{currentMax || '∞'}
          </span>
        )}
        <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-56 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium text-slate-500">Team size range</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-slate-400">–</span>
            <input
              type="number"
              placeholder="Max"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            onClick={apply}
            className="mt-2 w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

function SavedPresets() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [presets, setPresets] = useState<SavedPreset[]>(loadPresets);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [presetName, setPresetName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setNaming(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasFilters = searchParams.toString().length > 0;

  function savePreset() {
    if (!presetName.trim()) return;
    const newPreset: SavedPreset = {
      id: Math.random().toString(36).slice(2, 11),
      name: presetName.trim(),
      params: searchParams.toString(),
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    persistPresets(updated);
    setPresetName('');
    setNaming(false);
    showToast(`View "${newPreset.name}" saved`);
  }

  function loadPreset(preset: SavedPreset) {
    router.push(`${pathname}?${preset.params}`);
    setOpen(false);
  }

  function deletePreset(id: string) {
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    persistPresets(updated);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
      >
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
        </svg>
        Saved Views
        {presets.length > 0 && (
          <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-600">
            {presets.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-md border border-slate-200 bg-white shadow-lg">
          {presets.length > 0 && (
            <div className="max-h-48 overflow-y-auto border-b border-slate-100 py-1">
              {presets.map((p) => (
                <div key={p.id} className="group flex items-center justify-between px-3 py-1.5 hover:bg-slate-50">
                  <button
                    onClick={() => loadPreset(p)}
                    className="flex-1 text-left text-sm text-slate-700"
                  >
                    {p.name}
                  </button>
                  <button
                    onClick={() => deletePreset(p.id)}
                    className="hidden rounded p-0.5 text-slate-400 hover:text-rose-500 group-hover:block"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {presets.length === 0 && !naming && (
            <p className="px-3 py-3 text-xs text-slate-400">No saved views yet.</p>
          )}
          <div className="p-2">
            {naming ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="View name..."
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                  onClick={savePreset}
                  disabled={!presetName.trim()}
                  className="rounded-md bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setNaming(true)}
                disabled={!hasFilters}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm text-indigo-600 hover:bg-indigo-50 disabled:text-slate-400 disabled:hover:bg-transparent"
              >
                + Save current view
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
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
  const { showToast } = useToast();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [syncing, setSyncing] = useState(false);

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const selectedCount = selectedIds.length;

  async function handleBatchSync() {
    if (selectedCount === 0) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyIds: selectedIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Sync failed');
      }
      const data = await res.json();
      showToast(data.message || `Sync started for ${selectedCount} companies`);
      setRowSelection({});
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Sync failed. Please try again.', 'error');
    } finally {
      setSyncing(false);
    }
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <FilterBar filters={filters} searchPlaceholder="Search companies..." />
        </div>
        <TeamSizeFilter />
        <SavedPresets />
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5">
          <span className="text-sm font-medium text-indigo-900">
            {selectedCount} {selectedCount === 1 ? 'company' : 'companies'} selected
          </span>
          <Button
            variant="primary"
            size="sm"
            loading={syncing}
            onClick={handleBatchSync}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Sync selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRowSelection({})}
          >
            Clear selection
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <DataTable
          columns={columns}
          data={companies}
          onRowClick={(row) => router.push(`/companies/${row.id}`)}
          emptyMessage="No companies found. Try adjusting your filters or sync new data."
          enableRowSelection
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          getRowId={(row) => row.id}
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

export function AddCompanyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add Company
      </Button>
      {open && <AddCompanyModal onClose={() => setOpen(false)} />}
    </>
  );
}
