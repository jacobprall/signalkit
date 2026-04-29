import { sql } from 'drizzle-orm';
import { getDb, type Database } from '@/db/connection';
import { companies } from '@/db/schema';
import type { CollectedRecord } from '@/core/define-plugin';

export interface UpsertedCompany {
  sourceId: string;
  companyId: string;
  isNew: boolean;
}

export interface UpsertResult {
  total: number;
  created: number;
  updated: number;
  records: UpsertedCompany[];
}

const BATCH_SIZE = 100;

export async function upsertCompanies(
  records: readonly CollectedRecord[],
  database?: Database,
): Promise<UpsertResult> {
  const db = database ?? getDb();

  if (records.length === 0) {
    return { total: 0, created: 0, updated: 0, records: [] };
  }

  let created = 0;
  let updated = 0;
  const out: UpsertedCompany[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    const values = batch.map((record) => ({
      name: record.data.name as string,
      slug: record.data.slug as string,
      domain: ((record.data.domain as string) ?? null) || null,
      websiteUrl: ((record.data.website as string) ?? null) || null,
      source: record.source,
      sourceId: record.sourceId,
      sourceData: record.data,
      updatedAt: new Date(),
    }));

    // `xmax = 0` is the canonical Postgres trick: it's true on insert,
    // false on conflict-update, so it tells us whether each returned row
    // was newly created without a heuristic clock comparison.
    const result = await db
      .insert(companies)
      .values(values)
      .onConflictDoUpdate({
        target: [companies.source, companies.sourceId],
        set: {
          name: sql`excluded.name`,
          domain: sql`excluded.domain`,
          websiteUrl: sql`excluded.website_url`,
          sourceData: sql`excluded.source_data`,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        id: companies.id,
        sourceId: companies.sourceId,
        inserted: sql<boolean>`(xmax = 0)`,
      });

    for (const row of result) {
      out.push({
        sourceId: row.sourceId!,
        companyId: row.id,
        isNew: row.inserted,
      });
      if (row.inserted) created++;
      else updated++;
    }
  }

  return {
    total: records.length,
    created,
    updated,
    records: out,
  };
}
