'use client';

import { useState } from 'react';
import { Badge } from '../../components/badge';
import { Card } from '../../components/card';

interface SignalData {
  signalType: string;
  value: Record<string, unknown>;
  confidence: number | null;
  source: string;
  detectedAt: string;
}

interface PageData {
  id: string;
  url: string;
  pageType: string;
  contentText: string | null;
  scrapedAt: string | null;
}

interface ActionRunData {
  id: string;
  actionType: string;
  status: string;
  output: Record<string, unknown> | null;
  createdAt: string;
}

function SignalCard({ signal }: { signal: SignalData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <Badge label={signal.signalType.replace(/_/g, ' ')} variant="signal" />
          <p className="mt-2 text-xs text-slate-500">
            Source: {signal.source} &middot;{' '}
            {new Date(signal.detectedAt).toLocaleDateString()}
          </p>
          {signal.confidence !== null && (
            <p className="mt-1 text-xs text-slate-400">
              Confidence: {Math.round(signal.confidence * 100)}%
            </p>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-indigo-600 hover:text-indigo-700"
        >
          {expanded ? 'Hide' : 'Show'} details
        </button>
      </div>
      {expanded && (
        <pre className="mt-3 max-h-60 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
          {JSON.stringify(signal.value, null, 2)}
        </pre>
      )}
      {!expanded && (
        <div className="mt-2">
          {signal.signalType === 'hosting_detected' && (
            <Badge
              label={(signal.value as Record<string, string>).provider ?? 'unknown'}
              variant="hosting"
            />
          )}
          {signal.signalType === 'careers_page' && (
            <div className="flex flex-wrap gap-1">
              {(signal.value as Record<string, boolean>).has_devops && (
                <Badge label="DevOps" variant="signal" />
              )}
              {(signal.value as Record<string, boolean>).has_infra && (
                <Badge label="Infra" variant="signal" />
              )}
            </div>
          )}
          {signal.signalType === 'tech_stack' && (
            <div className="flex flex-wrap gap-1">
              {((signal.value as Record<string, string[]>).detected ?? []).slice(0, 6).map((t) => (
                <Badge key={t} label={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function PageAccordion({ page }: { page: PageData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-slate-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <span className="flex items-center gap-2">
          <Badge label={page.pageType} />
          <span className="text-xs text-slate-400 truncate max-w-xs">{page.url}</span>
        </span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-slate-200 px-4 py-3">
          {page.contentText ? (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-slate-600">
              {page.contentText.slice(0, 3000)}
              {(page.contentText.length > 3000) && '...'}
            </pre>
          ) : (
            <p className="text-sm text-slate-400">No content extracted</p>
          )}
          {page.scrapedAt && (
            <p className="mt-2 text-xs text-slate-400">
              Scraped: {new Date(page.scrapedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ActionRunCard({ run }: { run: ActionRunData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge label={run.actionType.replace(/_/g, ' ')} variant="signal" />
          <Badge label={run.status} variant="status" />
        </div>
        <span className="text-xs text-slate-400">
          {new Date(run.createdAt).toLocaleString()}
        </span>
      </div>
      {run.output && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-indigo-600 hover:text-indigo-700"
          >
            {expanded ? 'Collapse' : 'View output'}
          </button>
          {expanded && (
            <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(run.output, null, 2)}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

export function CompanySignals({
  signals,
  pages,
  actionRuns,
}: {
  signals: SignalData[];
  pages: PageData[];
  actionRuns: ActionRunData[];
}) {
  return (
    <div className="space-y-8">
      {signals.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {signals.map((s) => (
            <SignalCard key={s.signalType} signal={s} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">No signals detected yet. Try syncing this company.</p>
      )}

      {pages.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Crawled Pages</h2>
          <div className="space-y-2">
            {pages.map((p) => (
              <PageAccordion key={p.id} page={p} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">AI Outputs</h2>
        {actionRuns.length > 0 ? (
          <div className="space-y-3">
            {actionRuns.map((r) => (
              <ActionRunCard key={r.id} run={r} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            No AI outputs yet. Generate a brief or outreach to see results here.
          </p>
        )}
      </div>
    </div>
  );
}
