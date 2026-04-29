import {
  pgTable,
  uuid,
  text,
  boolean,
  real,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// companies
// ---------------------------------------------------------------------------
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').unique().notNull(),
    domain: text('domain'),
    websiteUrl: text('website_url'),
    logoUrl: text('logo_url'),
    source: text('source').notNull(),
    sourceId: text('source_id'),
    sourceData: jsonb('source_data'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('companies_source_source_id_idx').on(table.source, table.sourceId),
  ],
);

// ---------------------------------------------------------------------------
// pages
// ---------------------------------------------------------------------------
export const pages = pgTable('pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  url: text('url').unique().notNull(),
  pageType: text('page_type').notNull(),
  contentText: text('content_text'),
  contentHash: text('content_hash'),
  scrapedAt: timestamp('scraped_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// signals
// ---------------------------------------------------------------------------
export const signals = pgTable(
  'signals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    signalType: text('signal_type').notNull(),
    source: text('source').notNull(),
    value: jsonb('value').notNull(),
    previousValue: jsonb('previous_value'),
    confidence: real('confidence'),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('signals_company_signal_type_idx').on(table.companyId, table.signalType),
    index('signals_company_signal_detected_idx').on(
      table.companyId,
      table.signalType,
      table.detectedAt,
    ),
  ],
);

// ---------------------------------------------------------------------------
// triggers
// ---------------------------------------------------------------------------
export const triggers = pgTable('triggers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  conditions: jsonb('conditions').notNull(),
  actionType: text('action_type').notNull(),
  actionConfig: jsonb('action_config').default('{}'),
  deliveries: jsonb('deliveries').default('[]'),
  evaluation: text('evaluation').notNull().default('on_new_signal'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// action_runs  (defined before trigger_runs because trigger_runs references it)
// ---------------------------------------------------------------------------
export const actionRuns = pgTable('action_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  triggerId: uuid('trigger_id').references(() => triggers.id),
  companyId: uuid('company_id')
    .notNull()
    .references(() => companies.id),
  signalIds: text('signal_ids').array(),
  actionType: text('action_type').notNull(),
  status: text('status').notNull().default('pending'),
  input: jsonb('input'),
  output: jsonb('output'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// trigger_runs
// ---------------------------------------------------------------------------
export const triggerRuns = pgTable(
  'trigger_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    triggerId: uuid('trigger_id')
      .notNull()
      .references(() => triggers.id),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    signalHash: text('signal_hash').notNull(),
    actionRunId: uuid('action_run_id').references(() => actionRuns.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('trigger_runs_dedup_idx').on(
      table.triggerId,
      table.companyId,
      table.signalHash,
    ),
  ],
);

// ---------------------------------------------------------------------------
// collection_runs
// ---------------------------------------------------------------------------
export const collectionRuns = pgTable('collection_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectorType: text('collector_type').notNull(),
  status: text('status').notNull().default('running'),
  stats: jsonb('stats').default('{}'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;

export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;

export type Trigger = typeof triggers.$inferSelect;
export type NewTrigger = typeof triggers.$inferInsert;

export type TriggerRun = typeof triggerRuns.$inferSelect;
export type NewTriggerRun = typeof triggerRuns.$inferInsert;

export type ActionRun = typeof actionRuns.$inferSelect;
export type NewActionRun = typeof actionRuns.$inferInsert;

export type CollectionRun = typeof collectionRuns.$inferSelect;
export type NewCollectionRun = typeof collectionRuns.$inferInsert;
