import { and, eq, sql } from 'drizzle-orm';
import { getDb, type Database } from '@/db/connection';
import { signals, type Signal } from '@/db/schema';
import { stableStringify } from '@/utils/stable-stringify';

export interface UpsertSignalInput {
  companyId: string;
  signalType: string;
  source: string;
  value: Record<string, unknown>;
  confidence: number;
}

export interface UpsertResult {
  isNew: boolean;
  changed: boolean;
  signalId: string;
}

export interface ISignalRepository {
  upsert(signal: UpsertSignalInput): Promise<UpsertResult>;
  findByCompany(companyId: string): Promise<Signal[]>;
  findByCompanyAndType(
    companyId: string,
    signalType: string,
  ): Promise<Signal | null>;
  findByIds(ids: readonly string[]): Promise<Signal[]>;
}

export class SignalRepository implements ISignalRepository {
  constructor(private readonly db: Database = getDb()) {}

  async upsert(input: UpsertSignalInput): Promise<UpsertResult> {
    // Locate any existing row to know the previous value (a single
    // statement upsert can't tell us "was it the same, was it changed"
    // without an extra round-trip; we bias toward correctness).
    const existing = await this.findByCompanyAndType(
      input.companyId,
      input.signalType,
    );

    if (!existing) {
      const [row] = await this.db
        .insert(signals)
        .values({
          companyId: input.companyId,
          signalType: input.signalType,
          source: input.source,
          value: input.value,
          confidence: input.confidence,
          detectedAt: new Date(),
        })
        .returning({ id: signals.id });
      return { isNew: true, changed: false, signalId: row.id };
    }

    const changed =
      stableStringify(existing.value) !== stableStringify(input.value);

    if (changed) {
      await this.db
        .update(signals)
        .set({
          previousValue: existing.value as Record<string, unknown>,
          value: input.value,
          source: input.source,
          confidence: input.confidence,
          detectedAt: new Date(),
        })
        .where(
          and(
            eq(signals.companyId, input.companyId),
            eq(signals.signalType, input.signalType),
          ),
        );
    } else {
      // Refresh detectedAt so observability tells the truth about the
      // most recent observation, even when the value didn't change.
      await this.db
        .update(signals)
        .set({ detectedAt: new Date() })
        .where(eq(signals.id, existing.id));
    }

    return { isNew: false, changed, signalId: existing.id };
  }

  async findByCompany(companyId: string): Promise<Signal[]> {
    return this.db.query.signals.findMany({
      where: eq(signals.companyId, companyId),
      orderBy: (s, { desc }) => [desc(s.detectedAt)],
    });
  }

  async findByCompanyAndType(
    companyId: string,
    signalType: string,
  ): Promise<Signal | null> {
    const row = await this.db.query.signals.findFirst({
      where: and(
        eq(signals.companyId, companyId),
        eq(signals.signalType, signalType),
      ),
    });
    return row ?? null;
  }

  async findByIds(ids: readonly string[]): Promise<Signal[]> {
    if (ids.length === 0) return [];
    return this.db.query.signals.findMany({
      where: sql`${signals.id} = ANY(${ids})`,
    });
  }
}
