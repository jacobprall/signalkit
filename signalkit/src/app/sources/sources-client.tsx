'use client';

import { useState } from 'react';
import { Card } from '../components/card';
import { Badge } from '../components/badge';

interface CollectorSource {
  name: string;
  lastRun: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    stats: Record<string, unknown>;
  } | null;
}

function formatName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function RelativeTime({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-slate-400">Never</span>;
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return <span>Just now</span>;
  if (diffMin < 60) return <span>{diffMin}m ago</span>;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return <span>{diffHr}h ago</span>;
  return <span>{date.toLocaleDateString()}</span>;
}

function SourceCard({ source }: { source: CollectorSource }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleRun() {
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/collectors/${source.name}/run`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setState('success');
      setTimeout(() => setState('idle'), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
      setTimeout(() => setState('idle'), 5000);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">{formatName(source.name)}</h3>
          <p className="mt-0.5 text-xs font-mono text-slate-400">{source.name}</p>

          <div className="mt-3 flex items-center gap-3 text-sm">
            {source.lastRun ? (
              <>
                <Badge label={source.lastRun.status} variant="status" />
                <span className="text-slate-500">
                  <RelativeTime iso={source.lastRun.startedAt} />
                </span>
                {source.lastRun.stats && Object.keys(source.lastRun.stats).length > 0 && (
                  <span className="text-xs text-slate-400">
                    {Object.entries(source.lastRun.stats)
                      .filter(([k]) => k !== 'error')
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')}
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-400">No runs yet</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleRun}
            disabled={state === 'loading'}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${
              state === 'loading'
                ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                : state === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : state === 'error'
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {state === 'loading' && (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {state === 'idle' && 'Run Now'}
            {state === 'loading' && 'Running...'}
            {state === 'success' && 'Started'}
            {state === 'error' && 'Failed'}
          </button>
          {state === 'error' && errorMsg && (
            <p className="text-xs text-rose-500">{errorMsg}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function SourcesClient({ sources }: { sources: CollectorSource[] }) {
  return (
    <div className="space-y-4">
      {sources.length === 0 ? (
        <p className="text-sm text-slate-400">No data sources registered</p>
      ) : (
        sources.map((source) => <SourceCard key={source.name} source={source} />)
      )}
    </div>
  );
}
