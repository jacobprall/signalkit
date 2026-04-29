import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { Badge } from '../../components/badge';
import { Card } from '../../components/card';
import { SyncButton } from '../../components/sync-button';
import { ActionButton } from '../../components/action-button';
import { CompanySignals } from './signals-client';
import { getCompanyDetail } from '@/db/queries/companies';

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

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getCompanyDetail(id);
  if (!result) notFound();

  const { company, pages, actionRuns } = result;
  const meta = (company.source_data ?? company.metadata) as Record<string, unknown> | null;
  const oneLiner = getOneLiner(meta);
  const batch = getBatch(meta);
  const teamSize = getTeamSize(meta);

  return (
    <div>
      <Link
        href="/companies"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Companies
      </Link>

      <Card className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
            {oneLiner && <p className="mt-1 text-sm text-slate-500">{oneLiner}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              {company.domain && (
                <span className="inline-flex items-center gap-1">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  {company.domain}
                </span>
              )}
              {company.website_url && (
                <a
                  href={company.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  Visit website &rarr;
                </a>
              )}
              {batch && <Badge label={batch} variant="batch" />}
              {teamSize !== null && (
                <span className="text-slate-500">{teamSize} team members</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SyncButton companyId={company.id} label="Sync" size="sm" />
            <ActionButton companyId={company.id} actionType="prospect_brief" label="Generate Brief" />
            <ActionButton companyId={company.id} actionType="outreach_draft" label="Generate Outreach" />
            <ActionButton companyId={company.id} actionType="cost_analysis" label="Cost Analysis" />
          </div>
        </div>
      </Card>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">Signals</h2>
      <CompanySignals
        signals={company.signals.map((s) => ({
          signalType: s.signal_type,
          value: s.value,
          confidence: s.confidence,
          source: s.source,
          detectedAt: s.detected_at.toISOString(),
        }))}
        pages={pages.map((p) => ({
          id: p.url,
          url: p.url,
          pageType: p.page_type,
          contentText: p.content_text,
          scrapedAt: p.scraped_at?.toISOString() ?? null,
        }))}
        actionRuns={actionRuns.map((ar) => ({
          id: ar.id,
          actionType: ar.action_type,
          status: ar.status,
          output: ar.output,
          createdAt: ar.created_at.toISOString(),
        }))}
      />
    </div>
  );
}
