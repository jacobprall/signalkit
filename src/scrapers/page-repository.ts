import crypto from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, type Database } from '@/db/connection';
import type { Page, NewPage } from '@/db/schema';
import { pages } from '@/db/schema';

export interface UpsertPageResult {
  isNew: boolean;
  contentChanged: boolean;
  pageId: string;
}

export interface IPageRepository {
  findByUrl(url: string): Promise<Page | null>;
  upsert(page: NewPage): Promise<UpsertPageResult>;
  findByCompanyAndType(
    companyId: string,
    pageType: string,
  ): Promise<Page | null>;
}

export class PageRepository implements IPageRepository {
  constructor(private readonly db: Database = getDb()) {}

  async findByUrl(url: string): Promise<Page | null> {
    const row = await this.db.query.pages.findFirst({
      where: eq(pages.url, url),
    });
    return row ?? null;
  }

  async upsert(page: NewPage): Promise<UpsertPageResult> {
    // Single-statement upsert. We need to know:
    //   - was this row newly inserted?      => xmax = 0
    //   - did the contentHash change?       => previous_hash IS DISTINCT FROM new_hash
    //
    // Postgres exposes the existing row via the column reference (e.g.
    // pages.contentHash) and the proposed values via excluded.*; the
    // SET clause sees the OLD values on the right-hand side.
    const [row] = await this.db
      .insert(pages)
      .values(page)
      .onConflictDoUpdate({
        target: [pages.url],
        set: {
          contentText: sql`excluded.content_text`,
          contentHash: sql`excluded.content_hash`,
          scrapedAt: sql`excluded.scraped_at`,
        },
      })
      .returning({
        id: pages.id,
        inserted: sql<boolean>`(xmax = 0)`,
        // The same expression compares the pre-update value to excluded.
        // On insert, pre-update doesn't exist, so we treat that as changed.
        changed: sql<boolean>`(xmax = 0) OR (${pages.contentHash} IS DISTINCT FROM excluded.content_hash)`,
      });

    return {
      isNew: row.inserted,
      contentChanged: row.changed,
      pageId: row.id,
    };
  }

  async findByCompanyAndType(
    companyId: string,
    pageType: string,
  ): Promise<Page | null> {
    const row = await this.db.query.pages.findFirst({
      where: and(eq(pages.companyId, companyId), eq(pages.pageType, pageType)),
    });
    return row ?? null;
  }
}

export class MockPageRepository implements IPageRepository {
  private store: Map<string, Page> = new Map();

  async findByUrl(url: string): Promise<Page | null> {
    return this.store.get(url) ?? null;
  }

  async upsert(page: NewPage): Promise<UpsertPageResult> {
    const existing = this.store.get(page.url);
    const isNew = !existing;
    const contentChanged = isNew || existing.contentHash !== page.contentHash;

    const stored: Page = {
      id: existing?.id ?? crypto.randomUUID(),
      companyId: page.companyId,
      url: page.url,
      pageType: page.pageType,
      contentText: page.contentText ?? null,
      contentHash: page.contentHash ?? null,
      scrapedAt: page.scrapedAt ?? null,
      createdAt: existing?.createdAt ?? new Date(),
    };

    this.store.set(page.url, stored);
    return { isNew, contentChanged, pageId: stored.id };
  }

  async findByCompanyAndType(
    companyId: string,
    pageType: string,
  ): Promise<Page | null> {
    for (const page of this.store.values()) {
      if (page.companyId === companyId && page.pageType === pageType) {
        return page;
      }
    }
    return null;
  }
}
