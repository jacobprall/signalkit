import { NextResponse } from 'next/server';
import { getCompanyById } from '@/db/queries/companies';
import { notFound, badRequest, withApi } from '@/app/api/with-api';
import type { JobPayload } from '@/core/types';

export const POST = withApi<{ id: string; detector: string }>(async ({ params }) => {
  const company = await getCompanyById(params.id);
  if (!company) notFound('Company not found');

  const detectorName = params.detector;
  if (!/^[a-z][a-z0-9_]*$/.test(detectorName)) {
    badRequest('Invalid detector name');
  }

  const { getQueueClient } = await import('@/queue/client');
  const queue = getQueueClient();

  const job: JobPayload = { type: `detect:${detectorName}`, companyId: company.id };
  const jobId = await queue.enqueue(job);

  return NextResponse.json({
    jobId,
    detector: detectorName,
    companyId: company.id,
    message: `Detection job enqueued: ${detectorName}`,
  });
});
