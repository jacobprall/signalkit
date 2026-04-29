import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi, parseJson, badRequest } from '@/app/api/with-api';
import { getCompaniesByIds } from '@/db/queries/companies';
import type { JobPayload } from '@/core/types';

const BatchSyncSchema = z.object({
  companyIds: z.array(z.string().uuid()).min(1).max(100),
});

export const POST = withApi(async ({ request }) => {
  const contentType = request.headers.get('content-type') ?? '';
  const hasBody = contentType.includes('application/json');

  if (!hasBody) {
    const { getQueueClient } = await import('@/queue/client');
    const queue = getQueueClient();
    const jobId = await queue.enqueue({ type: 'collect:yc_directory' });
    return NextResponse.json({ jobId, message: 'Sync started' });
  }

  const { companyIds } = await parseJson(request, BatchSyncSchema);
  const companies = await getCompaniesByIds(companyIds);

  if (companies.length === 0) {
    badRequest('No valid companies found for the given IDs');
  }

  const { getQueueClient } = await import('@/queue/client');
  const queue = getQueueClient();

  const jobs: JobPayload[] = [];
  for (const company of companies) {
    if (company.website_url) {
      jobs.push({
        type: 'enrich',
        enricher: 'homepage',
        companyId: company.id,
        input: { url: company.website_url },
      });
    }
    if (company.domain) {
      jobs.push({ type: 'detect:hosting', companyId: company.id });
    }
  }

  if (jobs.length === 0) {
    return NextResponse.json({
      jobIds: [],
      companiesSynced: companies.length,
      message: 'No enrichment or detection jobs needed for the selected companies',
    });
  }

  const jobIds = await queue.enqueueBatch(jobs);

  return NextResponse.json({
    jobIds,
    companiesSynced: companies.length,
    message: `Sync started for ${companies.length} ${companies.length === 1 ? 'company' : 'companies'}`,
  });
});
