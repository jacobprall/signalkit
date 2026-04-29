import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '@/db/connection';
import { companies, triggers, triggerRuns } from '@/db/schema';
import { JobDispatcher, type JobHandler } from '@/queue/dispatcher';
import { QueueClient, type IQueueClient } from '@/queue/client';
import { AnthropicAIClient, type IAIClient } from '@/ai/client';

import { PluginRegistry } from '@/core/plugin-registry';
import type { PipelineContext } from '@/core/pipeline-context';
import type { JobPayload, TriggerConditions } from '@/core/types';
import {
  TriggerEvaluationService,
  type ISignalSource,
  type ITriggerRepository,
  type ITriggerRunRepository,
  type SignalForEvaluation,
  type TriggerRecord,
} from '@/core/trigger-service';

import { upsertCompanies } from '@/db/queries/company-upsert';
import { createCollectionRun, completeCollectionRun, failCollectionRun } from '@/db/queries/collection-runs';
import {
  SignalRepository,
  type ISignalRepository,
} from '@/db/queries/signals';
import {
  ActionRunRepository,
  type IActionRunRepository,
} from '@/db/queries/action-runs';

import {
  PageRepository,
  type IPageRepository,
} from '@/scrapers/page-repository';
import {
  PlaywrightBrowserManager,
  type IBrowserManager,
} from '@/scrapers/browser';
import {
  Scraper,
  homepageStrategy,
  careersStrategy,
  loginStrategy,
} from '@/scrapers/scraper';

import { createYCDirectoryCollector } from '@/collectors/yc-directory';
import { createHostingDetector } from '@/detectors/hosting';
import { createWebsiteAnalysisDetector } from '@/detectors/website-analysis';
import { createProspectBriefAction } from '@/actions/prospect-brief';
import { createOutreachDraftAction } from '@/actions/outreach-draft';
import { createCostAnalysisAction } from '@/actions/cost-analysis';
import { createChangeAlertAction } from '@/actions/change-alert';
import { createDashboardDelivery } from '@/deliveries/dashboard';
import { createSlackDelivery } from '@/deliveries/slack';
import { createEmailDelivery } from '@/deliveries/email';
import { createWebhookDelivery } from '@/deliveries/webhook';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface BootstrapDeps {
  queue?: IQueueClient;
  aiClient?: IAIClient;
  browser?: IBrowserManager;
  pageRepo?: IPageRepository;
  signalRepo?: ISignalRepository;
  actionRunRepo?: IActionRunRepository;
}

export interface BootstrappedSystem {
  registry: PluginRegistry;
  dispatcher: JobDispatcher;
  queue: IQueueClient;
  triggerService: TriggerEvaluationService;
  signalRepo: ISignalRepository;
  actionRunRepo: IActionRunRepository;
  shutdown(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Trigger repositories
// ---------------------------------------------------------------------------

class DrizzleTriggerRepository implements ITriggerRepository {
  async findActive(): Promise<TriggerRecord[]> {
    const db = getDb();
    const rows = await db.query.triggers.findMany({
      where: eq(triggers.isActive, true),
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      conditions: t.conditions as TriggerConditions,
      actionType: t.actionType,
      actionConfig: (t.actionConfig as Record<string, unknown>) ?? {},
      deliveries:
        (t.deliveries as Array<{ type: string; config: Record<string, unknown> }>) ?? [],
      isActive: !!t.isActive,
    }));
  }
}

class DrizzleTriggerRunRepository implements ITriggerRunRepository {
  async exists(triggerId: string, companyId: string, signalHash: string) {
    const db = getDb();
    const row = await db.query.triggerRuns.findFirst({
      where: (tr, { and: a, eq: e }) =>
        a(
          e(tr.triggerId, triggerId),
          e(tr.companyId, companyId),
          e(tr.signalHash, signalHash),
        ),
    });
    return !!row;
  }

  async create(run: {
    triggerId: string;
    companyId: string;
    signalHash: string;
    actionRunId: string;
  }) {
    const db = getDb();
    const [row] = await db
      .insert(triggerRuns)
      .values({
        triggerId: run.triggerId,
        companyId: run.companyId,
        signalHash: run.signalHash,
        actionRunId: run.actionRunId,
      })
      .returning({ id: triggerRuns.id });
    return row.id;
  }
}

class DrizzleSignalSource implements ISignalSource {
  constructor(private readonly repo: ISignalRepository) {}
  async findByCompany(companyId: string): Promise<SignalForEvaluation[]> {
    const rows = await this.repo.findByCompany(companyId);
    return rows.map((r) => ({
      signal_type: r.signalType,
      value: r.value as Record<string, unknown>,
    }));
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export function bootstrap(deps: BootstrapDeps = {}): BootstrappedSystem {
  const queue = deps.queue ?? new QueueClient();
  const aiClient = deps.aiClient ?? new AnthropicAIClient();
  const browser = deps.browser ?? new PlaywrightBrowserManager();
  const pageRepo = deps.pageRepo ?? new PageRepository();
  const signalRepo = deps.signalRepo ?? new SignalRepository();
  const actionRunRepo = deps.actionRunRepo ?? new ActionRunRepository();

  const enqueue = (job: JobPayload) => queue.enqueue(job).then(() => undefined);

  // --- Pipeline context ---
  const ctx: PipelineContext = {
    async getCompany(companyId) {
      const db = getDb();
      const company = await db.query.companies.findFirst({
        where: eq(companies.id, companyId),
      });
      if (!company) throw new Error(`Company not found: ${companyId}`);
      return company;
    },
    upsertSignal: (input) => signalRepo.upsert(input),
    findSignalsByCompany: (id) => signalRepo.findByCompany(id),
    findSignalsByIds: (ids) => signalRepo.findByIds(ids),
    createActionRun: (input) => actionRunRepo.create(input),
    markActionRunRunning: (id) => actionRunRepo.markRunning(id),
    markActionRunCompleted: (id, output) => actionRunRepo.markCompleted(id, output),
    markActionRunFailed: (id, error) => actionRunRepo.markFailed(id, error),
    findActionRun: (id) => actionRunRepo.findById(id),
    async getPageText(companyId, pageType) {
      const page = await pageRepo.findByCompanyAndType(companyId, pageType);
      return page?.contentText ?? null;
    },
    enqueue,
  };

  // --- Plugin registry ---
  const registry = new PluginRegistry();

  registry.register(createYCDirectoryCollector());
  registry.register(createHostingDetector());
  registry.register(createWebsiteAnalysisDetector(aiClient));
  registry.register(createProspectBriefAction(aiClient));
  registry.register(createOutreachDraftAction(aiClient));
  registry.register(createCostAnalysisAction(aiClient));
  registry.register(createChangeAlertAction(aiClient));
  registry.register(createDashboardDelivery());
  registry.register(createSlackDelivery());
  registry.register(createEmailDelivery());
  registry.register(createWebhookDelivery());

  // --- Trigger service ---
  const triggerService = new TriggerEvaluationService(
    new DrizzleTriggerRepository(),
    new DrizzleTriggerRunRepository(),
    new DrizzleSignalSource(signalRepo),
  );

  // --- Shared helpers ---

  async function runDetectorsForCompany(companyId: string) {
    const company = await ctx.getCompany(companyId);
    for (const detector of registry.getAllDetectors()) {
      const signals = await detector.detect(company, ctx);
      for (const sig of signals) {
        if (detector.schema) detector.schema.parse(sig.value);
        await ctx.upsertSignal({
          companyId,
          signalType: sig.signalType,
          source: sig.source,
          value: sig.value,
          confidence: sig.confidence,
        });
      }
    }
    await runTriggerEvaluation(companyId);
  }

  async function runTriggerEvaluation(companyId: string) {
    const triggered = await triggerService.evaluate(companyId);
    for (const t of triggered) {
      const run = await actionRunRepo.create({
        triggerId: t.triggerId,
        companyId: t.companyId,
        signalIds: [],
        actionType: t.actionType,
        input: { signalHash: t.signalHash },
      });

      try {
        await triggerService.recordRun({
          triggerId: t.triggerId,
          companyId: t.companyId,
          signalHash: t.signalHash,
          actionRunId: run.id,
        });
      } catch (err) {
        await actionRunRepo.markFailed(
          run.id,
          `Failed to persist trigger_run: ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }

      await runAction(run.id, t.companyId, t.actionType, t.actionConfig, t.deliveries);
    }
  }

  async function runAction(
    actionRunId: string,
    companyId: string,
    actionType: string,
    config: Record<string, unknown>,
    deliveries: Array<{ type: string; config: Record<string, unknown> }>,
  ) {
    const action = registry.requireAction(actionType);
    await ctx.markActionRunRunning(actionRunId);
    try {
      const company = await ctx.getCompany(companyId);
      const signals = await ctx.findSignalsByCompany(companyId);
      const output = await action.execute(company, signals, config, ctx);
      if (action.schema) action.schema.parse(output.content);
      await ctx.markActionRunCompleted(actionRunId, output.content);

      const toDeliver = deliveries.length ? deliveries : [{ type: 'dashboard', config: {} }];
      for (const d of toDeliver) {
        await enqueue({
          type: 'deliver',
          actionRunId,
          deliveryType: d.type,
          deliveryConfig: d.config,
        });
      }
    } catch (err) {
      await ctx.markActionRunFailed(
        actionRunId,
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  // --- Job dispatcher ---
  const dispatcher = new JobDispatcher();

  dispatcher.registerHandler('collect:yc_directory', async () => {
    const collector = registry.requireCollector('yc_directory');
    const runId = await createCollectionRun('yc_directory');
    try {
      const records = [];
      for await (const r of collector.collect(ctx)) {
        records.push(r);
      }
      const upsert = await upsertCompanies(records);
      for (const u of upsert.records) {
        const record = records.find((r) => r.sourceId === u.sourceId)!;
        const websiteUrl = record.data.website as string | undefined;
        const domain = record.data.domain as string | undefined;
        if (websiteUrl) {
          await enqueue({ type: 'scrape:homepage', companyId: u.companyId, url: websiteUrl });
        }
        if (domain) {
          await enqueue({ type: 'detect:hosting', companyId: u.companyId });
        }
      }
      await completeCollectionRun(runId, {
        found: records.length,
        created: upsert.created,
        updated: upsert.updated,
      });
    } catch (err) {
      await failCollectionRun(runId, err instanceof Error ? err.message : String(err));
      throw err;
    }
  });

  for (const [type, strategy] of [
    ['scrape:homepage', homepageStrategy],
    ['scrape:careers', careersStrategy],
    ['scrape:login', loginStrategy],
  ] as const) {
    dispatcher.registerHandler(type, async (job) => {
      if (job.type !== type) throw new Error(`expected ${type}, got ${job.type}`);
      const scraper = new Scraper(browser, pageRepo, strategy);
      const result = await scraper.scrape(job.companyId, job.url);
      if (result.contentChanged) {
        await enqueue({ type: 'detect:website_analysis', companyId: job.companyId });
      }
      for (const next of result.jobsToEnqueue) {
        await enqueue(next);
      }
    });
  }

  dispatcher.registerHandler('detect:hosting', async (job) => {
    if (job.type !== 'detect:hosting') throw new Error(`expected detect:hosting`);
    await runDetectorsForCompany(job.companyId);
  });

  dispatcher.registerHandler('detect:website_analysis', async (job) => {
    if (job.type !== 'detect:website_analysis') throw new Error(`expected detect:website_analysis`);
    await runDetectorsForCompany(job.companyId);
  });

  dispatcher.registerHandler('evaluate_triggers', async (job) => {
    if (job.type !== 'evaluate_triggers') throw new Error(`expected evaluate_triggers`);
    await runTriggerEvaluation(job.companyId);
  });

  dispatcher.registerHandler('evaluate_triggers:fanout', async () => {
    const db = getDb();
    const ids = await db.select({ id: companies.id }).from(companies);
    for (const { id } of ids) {
      await enqueue({ type: 'evaluate_triggers', companyId: id });
    }
  });

  dispatcher.registerHandler('action:run', async (job) => {
    if (job.type !== 'action:run') throw new Error(`expected action:run`);
    await runAction(job.actionRunId, job.companyId, job.actionType, job.config, [...job.deliveries]);
  });

  dispatcher.registerHandler('deliver', async (job) => {
    if (job.type !== 'deliver') throw new Error(`expected deliver`);
    const delivery = registry.requireDelivery(job.deliveryType);
    const run = await actionRunRepo.findById(job.actionRunId);
    if (!run) throw new Error(`action_run not found: ${job.actionRunId}`);
    const company = await ctx.getCompany(run.companyId);
    await delivery.deliver(run, company, job.deliveryConfig, ctx);
  });

  return {
    registry,
    dispatcher,
    queue,
    triggerService,
    signalRepo,
    actionRunRepo,
    async shutdown() {
      await queue.close();
      await browser.close();
      await closeDb();
    },
  };
}
