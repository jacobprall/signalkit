'use client';

import { useState } from 'react';
import { Badge } from '../../components/badge';
import { Button } from '../../components/button';
import { Card } from '../../components/card';
import { useToast } from '../../components/toast';

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

function RerunModal({
  run,
  onClose,
  onRerun,
}: {
  run: ActionRunData;
  onClose: () => void;
  onRerun: (runId: string) => void;
}) {
  const existingConfig = (run.output as Record<string, unknown>) ?? {};
  const promptFromOutput = (existingConfig.prompt as string) ?? '';
  const [customPrompt, setCustomPrompt] = useState(promptFromOutput);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleRerun(withEdits: boolean) {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (withEdits && customPrompt.trim()) {
        body.configOverrides = { prompt: customPrompt.trim() };
      }

      const res = await fetch(`/api/action-runs/${run.id}/rerun`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Re-run failed');
      }
      const data = await res.json();
      showToast(`Action re-run started (${run.actionType.replace(/_/g, ' ')})`);
      onRerun(data.actionRun.id);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Re-run failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            Re-run: {run.actionType.replace(/_/g, ' ')}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-slate-600">
            This will create a new action run for the same company and signals.
            You can optionally modify the prompt before regenerating.
          </p>

          <div>
            <label htmlFor="rerun-prompt" className="block text-sm font-medium text-slate-700 mb-1.5">
              Custom prompt (optional)
            </label>
            <textarea
              id="rerun-prompt"
              rows={5}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Leave empty to use the original prompt, or enter a modified prompt..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={loading}
            onClick={() => handleRerun(false)}
          >
            Re-run as-is
          </Button>
          {customPrompt.trim() && (
            <Button
              variant="primary"
              size="sm"
              loading={loading}
              onClick={() => handleRerun(true)}
            >
              Re-run with edits
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionRunCard({
  run,
  onRerun,
}: {
  run: ActionRunData;
  onRerun: (newRunId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRerunModal, setShowRerunModal] = useState(false);

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Badge label={run.actionType.replace(/_/g, ' ')} variant="signal" />
            <Badge label={run.status} variant="status" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {new Date(run.createdAt).toLocaleString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRerunModal(true)}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Re-run
            </Button>
          </div>
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

      {showRerunModal && (
        <RerunModal
          run={run}
          onClose={() => setShowRerunModal(false)}
          onRerun={onRerun}
        />
      )}
    </>
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
  const [runs, setRuns] = useState(actionRuns);

  function handleRerun(newRunId: string) {
    setRuns((prev) => [
      { id: newRunId, actionType: prev[0]?.actionType ?? 'unknown', status: 'pending', output: null, createdAt: new Date().toISOString() },
      ...prev,
    ]);
  }

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
        {runs.length > 0 ? (
          <div className="space-y-3">
            {runs.map((r) => (
              <ActionRunCard key={r.id} run={r} onRerun={handleRerun} />
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
