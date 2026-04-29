'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

interface FilterOption {
  label: string;
  value: string;
}

interface FilterDef {
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterBarProps {
  filters: FilterDef[];
  searchPlaceholder?: string;
}

function Dropdown({
  filter,
  selected,
  onToggle,
}: {
  filter: FilterDef;
  selected: string[];
  onToggle: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
      >
        {filter.label}
        {selected.length > 0 && (
          <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white">
            {selected.length}
          </span>
        )}
        <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {filter.options.map((opt) => {
            const checked = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => onToggle(filter.key, opt.value)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                  }`}
                >
                  {checked && (
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FilterBar({ filters, searchPlaceholder = 'Search...' }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [searchValue, setSearchValue] = useState(initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input controlled but synced when the URL changes from outside
  // (e.g. user clicks "Clear all").
  useEffect(() => {
    setSearchValue(initialQ);
  }, [initialQ]);

  const getSelected = useCallback(
    (key: string) => searchParams.getAll(key),
    [searchParams],
  );

  function updateParams(key: string, values: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    values.forEach((v) => params.append(key, v));
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleToggle(key: string, value: string) {
    const current = getSelected(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateParams(key, next);
  }

  function commitSearch(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set('q', q);
    } else {
      params.delete('q');
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(q: string) {
    setSearchValue(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitSearch(q), SEARCH_DEBOUNCE_MS);
  }

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchValue('');
    router.push(pathname);
  }

  const hasFilters = filters.some((f) => getSelected(f.key).length > 0) || !!initialQ;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-8 w-56 rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {filters.map((f) => (
        <Dropdown key={f.key} filter={f} selected={getSelected(f.key)} onToggle={handleToggle} />
      ))}

      {hasFilters && (
        <button
          onClick={clearAll}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Clear all
        </button>
      )}

      {/* Active filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {filters.flatMap((f) =>
          getSelected(f.key).map((v) => (
            <span
              key={`${f.key}-${v}`}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              {v}
              <button
                onClick={() => handleToggle(f.key, v)}
                className="ml-0.5 hover:text-indigo-900"
              >
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </span>
          )),
        )}
      </div>
    </div>
  );
}
