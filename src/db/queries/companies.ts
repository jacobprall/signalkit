import { eq, ilike, and, sql, inArray, type SQL } from 'drizzle-orm';
import { getDb } from '@/db/connection';
import { companies, signals, pages, actionRuns, type Company } from '@/db/schema';
import { escapeIlike } from '@/app/api/with-api';

export interface CompanyFilters {
  hostingProvider?: string[];
  batch?: string[];
  industry?: string[];
  teamSizeMin?: number;
  teamSizeMax?: number;
  hasSignalType?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CompanySignalDTO {
  signal_type: string;
  source: string;
  value: Record<string, unknown>;
  confidence: number | null;
  detected_at: Date;
}

export interface CompanyWithSignals {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  website_url: string | null;
  logo_url: string | null;
  source: string;
  source_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  is_archived: boolean;
  created_at: Date;
  signals: CompanySignalDTO[];
}

interface SignalRow {
  signalType: string;
  source: string;
  value: unknown;
  confidence: number | null;
  detectedAt: Date;
}

export function toCompanyDTO(
  company: Company,
  companySignals: SignalRow[],
): CompanyWithSignals {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    domain: company.domain,
    website_url: company.websiteUrl,
    logo_url: company.logoUrl,
    source: company.source,
    source_data: company.sourceData as Record<string, unknown> | null,
    metadata: company.metadata as Record<string, unknown> | null,
    is_archived: company.isArchived,
    created_at: company.createdAt!,
    signals: companySignals.map(toSignalDTO),
  };
}

function toSignalDTO(s: SignalRow): CompanySignalDTO {
  return {
    signal_type: s.signalType,
    source: s.source,
    value: s.value as Record<string, unknown>,
    confidence: s.confidence,
    detected_at: s.detectedAt,
  };
}

function buildWhereConditions(filters: CompanyFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.search) {
    conditions.push(ilike(companies.name, `%${escapeIlike(filters.search)}%`));
  }

  if (filters.hostingProvider?.length) {
    const arr = filters.hostingProvider;
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${signals}
        WHERE ${signals.companyId} = ${companies.id}
          AND ${signals.signalType} = 'hosting_detected'
          AND ${signals.value}->>'provider' IN (${sql.join(arr.map(v => sql`${v}`), sql`, `)})
      )`,
    );
  }

  if (filters.batch?.length) {
    const arr = filters.batch;
    conditions.push(
      sql`${companies.sourceData}->>'batch' IN (${sql.join(arr.map(v => sql`${v}`), sql`, `)})`,
    );
  }

  if (filters.industry?.length) {
    const arr = filters.industry;
    conditions.push(
      sql`${companies.sourceData}->>'industry' IN (${sql.join(arr.map(v => sql`${v}`), sql`, `)})`,
    );
  }

  if (filters.teamSizeMin !== undefined) {
    conditions.push(
      sql`(${companies.sourceData}->>'team_size')::int >= ${filters.teamSizeMin}`,
    );
  }

  if (filters.teamSizeMax !== undefined) {
    conditions.push(
      sql`(${companies.sourceData}->>'team_size')::int <= ${filters.teamSizeMax}`,
    );
  }

  if (filters.hasSignalType?.length) {
    const arr = filters.hasSignalType;
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${signals}
        WHERE ${signals.companyId} = ${companies.id}
          AND ${signals.signalType} IN (${sql.join(arr.map(v => sql`${v}`), sql`, `)})
      )`,
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listCompanies(
  filters: CompanyFilters,
): Promise<{ companies: CompanyWithSignals[]; total: number }> {
  const db = getDb();
  const where = buildWhereConditions(filters);
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const [companyRows, countResult] = await Promise.all([
    db.query.companies.findMany({
      where,
      limit,
      offset,
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(companies)
      .where(where),
  ]);

  const companyIds = companyRows.map((c) => c.id);
  const signalRows = companyIds.length
    ? await db.query.signals.findMany({
        where: inArray(signals.companyId, companyIds),
      })
    : [];

  const signalsByCompany = new Map<string, SignalRow[]>();
  for (const s of signalRows) {
    const list = signalsByCompany.get(s.companyId) ?? [];
    list.push(s);
    signalsByCompany.set(s.companyId, list);
  }

  return {
    companies: companyRows.map((c) => toCompanyDTO(c, signalsByCompany.get(c.id) ?? [])),
    total: countResult[0]?.count ?? 0,
  };
}

export async function getCompaniesByIds(ids: string[]): Promise<CompanyWithSignals[]> {
  if (ids.length === 0) return [];
  const db = getDb();

  const companyRows = await db.query.companies.findMany({
    where: inArray(companies.id, ids),
  });

  const signalRows = companyRows.length
    ? await db.query.signals.findMany({
        where: inArray(signals.companyId, companyRows.map((c) => c.id)),
      })
    : [];

  const signalsByCompany = new Map<string, SignalRow[]>();
  for (const s of signalRows) {
    const list = signalsByCompany.get(s.companyId) ?? [];
    list.push(s);
    signalsByCompany.set(s.companyId, list);
  }

  return companyRows.map((c) => toCompanyDTO(c, signalsByCompany.get(c.id) ?? []));
}

export async function getCompanyById(id: string): Promise<CompanyWithSignals | null> {
  const db = getDb();

  // Single round-trip via Drizzle's relational `with` — replaces two
  // sequential queries that the old code used.
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, id),
  });
  if (!company) return null;

  const companySignals = await db.query.signals.findMany({
    where: eq(signals.companyId, id),
  });

  return toCompanyDTO(company, companySignals);
}

export async function getCompanyDetail(id: string): Promise<{
  company: CompanyWithSignals;
  pages: Array<{
    url: string;
    page_type: string;
    content_text: string | null;
    scraped_at: Date | null;
  }>;
  actionRuns: Array<{
    id: string;
    action_type: string;
    status: string;
    output: Record<string, unknown> | null;
    created_at: Date;
  }>;
} | null> {
  const db = getDb();

  const company = await db.query.companies.findFirst({
    where: eq(companies.id, id),
  });

  if (!company) return null;

  const [companySignals, companyPages, companyActions] = await Promise.all([
    db.query.signals.findMany({ where: eq(signals.companyId, id) }),
    db.query.pages.findMany({ where: eq(pages.companyId, id) }),
    db.query.actionRuns.findMany({
      where: eq(actionRuns.companyId, id),
      orderBy: (ar, { desc }) => [desc(ar.createdAt)],
    }),
  ]);

  return {
    company: toCompanyDTO(company, companySignals),
    pages: companyPages.map((p) => ({
      url: p.url,
      page_type: p.pageType,
      content_text: p.contentText,
      scraped_at: p.scrapedAt,
    })),
    actionRuns: companyActions.map((ar) => ({
      id: ar.id,
      action_type: ar.actionType,
      status: ar.status,
      output: ar.output as Record<string, unknown> | null,
      created_at: ar.createdAt!,
    })),
  };
}
