import { describe, it, expect } from 'vitest';
import {
  companies,
  pages,
  signals,
  triggers,
  triggerRuns,
  actionRuns,
  collectionRuns,
} from '@/db/schema';
import { getTableName } from 'drizzle-orm';

describe('Database Schema', () => {
  describe('table exports', () => {
    it('exports all tables', () => {
      expect(companies).toBeDefined();
      expect(pages).toBeDefined();
      expect(signals).toBeDefined();
      expect(triggers).toBeDefined();
      expect(triggerRuns).toBeDefined();
      expect(actionRuns).toBeDefined();
      expect(collectionRuns).toBeDefined();
    });
  });

  describe('table names', () => {
    it('companies table is named correctly', () => {
      expect(getTableName(companies)).toBe('companies');
    });

    it('pages table is named correctly', () => {
      expect(getTableName(pages)).toBe('pages');
    });

    it('signals table is named correctly', () => {
      expect(getTableName(signals)).toBe('signals');
    });

    it('triggers table is named correctly', () => {
      expect(getTableName(triggers)).toBe('triggers');
    });

    it('trigger_runs table is named correctly', () => {
      expect(getTableName(triggerRuns)).toBe('trigger_runs');
    });

    it('action_runs table is named correctly', () => {
      expect(getTableName(actionRuns)).toBe('action_runs');
    });

    it('collection_runs table is named correctly', () => {
      expect(getTableName(collectionRuns)).toBe('collection_runs');
    });
  });

  describe('companies table columns', () => {
    it('has all required columns', () => {
      const cols = companies as unknown as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.name).toBeDefined();
      expect(cols.slug).toBeDefined();
      expect(cols.domain).toBeDefined();
      expect(cols.websiteUrl).toBeDefined();
      expect(cols.logoUrl).toBeDefined();
      expect(cols.source).toBeDefined();
      expect(cols.sourceId).toBeDefined();
      expect(cols.sourceData).toBeDefined();
      expect(cols.metadata).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.updatedAt).toBeDefined();
    });
  });

  describe('pages table columns', () => {
    it('has all required columns', () => {
      const cols = pages as unknown as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.companyId).toBeDefined();
      expect(cols.url).toBeDefined();
      expect(cols.pageType).toBeDefined();
      expect(cols.contentText).toBeDefined();
      expect(cols.contentHash).toBeDefined();
      expect(cols.scrapedAt).toBeDefined();
      expect(cols.createdAt).toBeDefined();
    });
  });

  describe('signals table columns', () => {
    it('has all required columns', () => {
      const cols = signals as unknown as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.companyId).toBeDefined();
      expect(cols.signalType).toBeDefined();
      expect(cols.source).toBeDefined();
      expect(cols.value).toBeDefined();
      expect(cols.previousValue).toBeDefined();
      expect(cols.confidence).toBeDefined();
      expect(cols.detectedAt).toBeDefined();
      expect(cols.expiresAt).toBeDefined();
    });
  });

  describe('triggers table columns', () => {
    it('has all required columns', () => {
      const cols = triggers as unknown as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.name).toBeDefined();
      expect(cols.conditions).toBeDefined();
      expect(cols.actionType).toBeDefined();
      expect(cols.actionConfig).toBeDefined();
      expect(cols.deliveries).toBeDefined();
      expect(cols.evaluation).toBeDefined();
      expect(cols.isActive).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.updatedAt).toBeDefined();
    });
  });

  describe('trigger_runs table columns', () => {
    it('has all required columns', () => {
      const cols = triggerRuns as unknown as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.triggerId).toBeDefined();
      expect(cols.companyId).toBeDefined();
      expect(cols.signalHash).toBeDefined();
      expect(cols.actionRunId).toBeDefined();
      expect(cols.createdAt).toBeDefined();
    });
  });

  describe('action_runs table columns', () => {
    it('has all required columns', () => {
      const cols = actionRuns as unknown as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.triggerId).toBeDefined();
      expect(cols.companyId).toBeDefined();
      expect(cols.signalIds).toBeDefined();
      expect(cols.actionType).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.input).toBeDefined();
      expect(cols.output).toBeDefined();
      expect(cols.error).toBeDefined();
      expect(cols.createdAt).toBeDefined();
      expect(cols.completedAt).toBeDefined();
    });
  });

  describe('collection_runs table columns', () => {
    it('has all required columns', () => {
      const cols = collectionRuns as unknown as Record<string, unknown>;
      expect(cols.id).toBeDefined();
      expect(cols.collectorType).toBeDefined();
      expect(cols.status).toBeDefined();
      expect(cols.stats).toBeDefined();
      expect(cols.startedAt).toBeDefined();
      expect(cols.completedAt).toBeDefined();
    });
  });
});
