import { NextResponse } from 'next/server';
import { getCompanyById } from '@/db/queries/companies';
import { notFound, withApi } from '@/app/api/with-api';
import type { JobPayload } from '@/core/types';

export const POST = withApi<{ id: string }>(async ({ params }) => {
  const company = await getCompanyById(params.id);
  if (!company) notFound('Company not found');

  const { getQueueClient } = await import('@/queue/client');
  const queue = getQueueClient();

  const jobs: JobPayload[] = [];
  if (company.website_url) {
    jobs.push({ type: 'scrape:homepage', companyId: company.id, url: company.website_url });
  }
  if (company.domain) {
    jobs.push({ type: 'detect:hosting', companyId: company.id });
  }

  const jobIds = await queue.enqueueBatch(jobs);
  return NextResponse.json({ jobIds, message: 'Company sync started' });
});
