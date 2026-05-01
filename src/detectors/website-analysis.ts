// @deprecated — Split into hiring-analysis.ts, product-analysis.ts, and tech-stack-analysis.ts.
// This file is kept for backward compatibility during the transition.

import type { IAIClient } from '@/ai/client';
import { defineDetector, type DetectedSignal } from '@/core/define-plugin';
import { createLogger } from '@/lib/logger';

const log = createLogger('detector:website_analysis');
import {
  CareersAnalysisSchema,
  buildCareersPrompt,
} from '@/ai/prompts/careers-analysis';
import {
  ProductAnalysisSchema,
  TechStackSchema,
  buildProductPrompt,
  buildTechStackPrompt,
} from '@/ai/prompts/product-analysis';

export function createWebsiteAnalysisDetector(aiClient: IAIClient) {
  return defineDetector({
    name: 'website_analysis',

    async detect(company, ctx): Promise<DetectedSignal[]> {
      const scopedClient = aiClient.withContext
        ? aiClient.withContext({ action: 'website_analysis', companyId: company.id })
        : aiClient;

      const [careersText, homepageText, loginText] = await Promise.all([
        ctx.getPageText(company.id, 'careers'),
        ctx.getPageText(company.id, 'homepage'),
        ctx.getPageText(company.id, 'login'),
      ]);

      const out: DetectedSignal[] = [];
      const tasks: Promise<DetectedSignal | null>[] = [];

      if (careersText) {
        tasks.push(runCareers(scopedClient, careersText));
      }
      if (homepageText) {
        tasks.push(runProduct(scopedClient, homepageText, loginText ?? undefined));
        tasks.push(
          runTechStack(scopedClient, [
            { type: 'homepage', text: homepageText },
            ...(loginText ? [{ type: 'login', text: loginText }] : []),
            ...(careersText ? [{ type: 'careers', text: careersText }] : []),
          ]),
        );
      }

      const results = await Promise.allSettled(tasks);
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          out.push(r.value);
        } else if (r.status === 'rejected') {
          log.error({ companyId: company.id, err: r.reason }, 'sub-task failed');
        }
      }
      return out;
    },
  });
}

async function runCareers(
  aiClient: IAIClient,
  text: string,
): Promise<DetectedSignal> {
  const result = await aiClient.analyze(
    buildCareersPrompt(text),
    CareersAnalysisSchema,
  );
  return {
    signalType: 'careers_page',
    source: 'ai_analysis',
    value: result as unknown as Record<string, unknown>,
    confidence: 0.85,
  };
}

async function runProduct(
  aiClient: IAIClient,
  homepageText: string,
  loginText?: string,
): Promise<DetectedSignal> {
  const result = await aiClient.analyze(
    buildProductPrompt(homepageText, loginText),
    ProductAnalysisSchema,
  );
  return {
    signalType: 'product_profile',
    source: 'ai_analysis',
    value: result as unknown as Record<string, unknown>,
    confidence: 0.8,
  };
}

async function runTechStack(
  aiClient: IAIClient,
  pages: { type: string; text: string }[],
): Promise<DetectedSignal> {
  const result = await aiClient.analyze(
    buildTechStackPrompt(pages),
    TechStackSchema,
  );
  return {
    signalType: 'tech_stack',
    source: 'ai_analysis',
    value: result as unknown as Record<string, unknown>,
    confidence: 0.75,
  };
}
