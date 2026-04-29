import { z } from 'zod';
import { defineDelivery } from '@/core/define-plugin';

export const WebhookConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).default({}),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

export type WebhookFetcher = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export function createWebhookDelivery(fetcher?: WebhookFetcher) {
  const fetch = fetcher ?? (globalThis.fetch as unknown as WebhookFetcher);

  return defineDelivery({
    name: 'webhook',

    async deliver(actionRun, company, config, _ctx) {
      const cfg = WebhookConfigSchema.parse(config);

      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...cfg.headers,
        },
        body: JSON.stringify({
          actionRunId: actionRun.id,
          actionType: actionRun.actionType,
          company: {
            id: company.id,
            name: company.name,
            domain: company.domain,
          },
          output: actionRun.output,
          completedAt: actionRun.completedAt,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`Webhook delivery failed: ${res.status} ${body}`);
      }
    },
  });
}
