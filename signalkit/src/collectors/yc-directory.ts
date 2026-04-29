import { defineCollector, type CollectedRecord } from '@/core/define-plugin';
import { parseDomain } from '@/utils/parse-domain';

const YC_API_URL = 'https://yc-oss.github.io/api/companies/all.json';

interface YCCompany {
  id: number;
  name: string;
  slug: string;
  website: string;
  team_size: number;
  status: string;
  one_liner: string;
  long_description: string;
  industries: string[];
  tags: string[];
  batch: string;
  stage: string;
  isHiring: boolean;
  url: string;
  [key: string]: unknown;
}

type Fetcher = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

function isActiveSmallCompany(company: YCCompany): boolean {
  return (
    company.team_size >= 1 &&
    company.team_size <= 50 &&
    company.status === 'Active'
  );
}

export function createYCDirectoryCollector(fetcher?: Fetcher) {
  const fetch = fetcher ?? (globalThis.fetch as unknown as Fetcher);

  return defineCollector({
    name: 'yc_directory',

    async *collect(_ctx): AsyncGenerator<CollectedRecord> {
      let companies: YCCompany[];

      try {
        const response = await fetch(YC_API_URL);
        if (!response.ok) {
          console.error(
            `[yc-directory] fetch failed: HTTP ${('status' in response && (response as { status?: number }).status) ?? 'unknown'}`,
          );
          return;
        }
        companies = (await response.json()) as YCCompany[];
      } catch (err) {
        console.error('[yc-directory] fetch error:', err);
        return;
      }

      for (const company of companies) {
        if (!isActiveSmallCompany(company)) continue;
        if (!company.website) continue;

        const domain = parseDomain(company.website);
        if (!domain) continue;

        yield {
          source: 'yc_directory',
          sourceId: String(company.id),
          data: {
            ...company,
            name: company.name,
            slug: company.slug,
            website: company.website,
            domain,
            team_size: company.team_size,
            one_liner: company.one_liner,
            long_description: company.long_description,
            industry: company.industries?.[0] ?? null,
            industries: company.industries,
            tags: company.tags,
            batch: company.batch,
            stage: company.stage,
            isHiring: company.isHiring,
            url: company.url,
          },
        };
      }
    },
  });
}
