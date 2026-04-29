'use client';

import { useState } from 'react';
import { Badge } from '../components/badge';
import { Card } from '../components/card';

export interface ActionRunRow {
  id: string;
  actionType: string;
  status: string;
  companyId: string;
  companyName?: string;
  output: Record<string, unknown> | null;
  createdAt: string;
}

function ProspectBriefOutput({ output }: { output: Record<string, unknown> }) {
  const summary = typeof output.summary === 'string' ? output.summary : null;
  const infra = typeof output.infrastructure_assessment === 'string' ? output.infrastructure_assessment : null;
  const signalsSummary = typeof output.signals_summary === 'string' ? output.signals_summary : null;
  const approach = typeof output.approach_angle === 'string' ? output.approach_angle : null;

  return (
    <div className="space-y-3 text-sm text-slate-700">
      {summary && (
        <div>
          <h4 className="font-medium text-slate-900">Summary</h4>
          <p>{summary}</p>
        </div>
      )}
      {infra && (
        <div>
          <h4 className="font-medium text-slate-900">Infrastructure Assessment</h4>
          <p>{infra}</p>
        </div>
      )}
      {signalsSummary && (
        <div>
          <h4 className="font-medium text-slate-900">Signal Highlights</h4>
          <p>{signalsSummary}</p>
        </div>
      )}
      {approach && (
        <div>
          <h4 className="font-medium text-slate-900">Recommended Approach</h4>
          <p>{approach}</p>
        </div>
      )}
    </div>
  );
}

function OutreachOutput({ output }: { output: Record<string, unknown> }) {
  const subject = typeof output.subject === 'string' ? output.subject : null;
  const body = typeof output.body === 'string' ? output.body : null;

  return (
    <div className="space-y-3 text-sm text-slate-700">
      {subject && (
        <div>
          <h4 className="font-medium text-slate-900">Subject</h4>
          <p className="font-mono text-indigo-700">{subject}</p>
        </div>
      )}
      {body && (
        <div>
          <h4 className="font-medium text-slate-900">Body</h4>
          <p className="whitespace-pre-wrap">{body}</p>
        </div>
      )}
    </div>
  );
}

function GenericOutput({ output }: { output: Record<string, unknown> }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-md bg-slate-50 p-3 text-xs text-slate-700">
      {JSON.stringify(output, null, 2)}
    </pre>
  );
}

function ActionRunCard({ run }: { run: ActionRunRow }) {
  const [expanded, setExpanded] = useState(false);

  function renderOutput(output: Record<string, unknown>) {
    switch (run.actionType) {
      case 'prospect_brief':
        return <ProspectBriefOutput output={output} />;
      case 'outreach_draft':
        return <OutreachOutput output={output} />;
      default:
        return <GenericOutput output={output} />;
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge label={run.actionType.replace(/_/g, ' ')} variant="signal" />
          <Badge label={run.status} variant="status" />
          {run.companyName && (
            <span className="text-sm font-medium text-slate-700">{run.companyName}</span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {new Date(run.createdAt).toLocaleString()}
        </span>
      </div>

      {run.output && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            {expanded ? 'Collapse' : 'View output'}
          </button>
          {expanded && <div className="mt-3">{renderOutput(run.output)}</div>}
        </div>
      )}

      {run.status === 'failed' && (
        <p className="mt-2 text-xs text-rose-500">Action failed to complete</p>
      )}
    </Card>
  );
}

export function ActionsClient({ actionRuns }: { actionRuns: ActionRunRow[] }) {
  if (actionRuns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-20 text-slate-400 shadow-sm">
        <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
        <p className="text-sm">No AI outputs yet</p>
        <p className="mt-1 text-xs">Sync companies and configure triggers to generate outputs</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionRuns.map((run) => (
        <ActionRunCard key={run.id} run={run} />
      ))}
    </div>
  );
}
