import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJson, badRequest, withApi } from '@/app/api/with-api';
import { upsertCompanies } from '@/db/queries/company-upsert';
import { parseDomain } from '@/utils/parse-domain';
import type { JobPayload } from '@/core/types';

const ENRICHER_NAMES = ['homepage', 'careers', 'login'] as const;

const AddCompanySchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(200).optional(),
  enrichers: z.array(z.enum(ENRICHER_NAMES)).default(['homepage']),
  detectHosting: z.boolean().default(true),
});

export const POST = withApi(async ({ request }) => {
  const body = await parseJson(request, AddCompanySchema);

  let websiteUrl = body.url;
  if (!/^https?:\/\//i.test(websiteUrl)) {
    websiteUrl = `https://${websiteUrl}`;
  }

  const domain = parseDomain(websiteUrl);
  if (!domain) {
    badRequest('Could not parse domain from the provided URL');
  }

  const companyName = body.name ?? domain.split('.')[0].replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const slug = domain.replace(/\./g, '-');

  const result = await upsertCompanies([
    {
      source: 'manual',
      sourceId: domain,
      data: {
        name: companyName,
        slug,
        website: websiteUrl,
        domain,
      },
    },
  ]);

  const upserted = result.records[0];
  if (!upserted) {
    badRequest('Failed to create company');
  }

  const { getQueueClient } = await import('@/queue/client');
  const queue = getQueueClient();

  const jobs: JobPayload[] = [];
  for (const enricher of body.enrichers) {
    const inputUrl = enricher === 'homepage' ? websiteUrl : websiteUrl;
    jobs.push({
      type: 'enrich',
      enricher,
      companyId: upserted.companyId,
      input: { url: inputUrl },
    });
  }
  if (body.detectHosting) {
    jobs.push({ type: 'detect:hosting', companyId: upserted.companyId });
  }

  const jobIds = await queue.enqueueBatch(jobs);

  return NextResponse.json(
    {
      company: {
        id: upserted.companyId,
        name: companyName,
        domain,
        isNew: upserted.isNew,
      },
      jobIds,
      enrichers: body.enrichers,
      detectHosting: body.detectHosting,
      message: upserted.isNew
        ? `Company "${companyName}" created and enrichment started`
        : `Company "${companyName}" already exists — enrichment re-started`,
    },
    { status: upserted.isNew ? 201 : 200 },
  );
});
