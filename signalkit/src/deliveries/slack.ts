import { z } from 'zod';
import { defineDelivery } from '@/core/define-plugin';

export const SlackConfigSchema = z.object({
  webhookUrl: z.string().url(),
  username: z.string().optional(),
});

export type SlackConfig = z.infer<typeof SlackConfigSchema>;

export type SlackFetcher = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export function createSlackDelivery(fetcher?: SlackFetcher) {
  const fetch = fetcher ?? (globalThis.fetch as unknown as SlackFetcher);

  return defineDelivery({
    name: 'slack',

    async deliver(actionRun, company, config, _ctx) {
      const cfg = SlackConfigSchema.parse(config);
      const output = (actionRun.output ?? {}) as Record<string, unknown>;
      const headline =
        (output.summary as string) ??
        (output.subject as string) ??
        (output.change_description as string) ??
        `New ${actionRun.actionType} for ${company.name}`;
      const summary = `*${company.name}* — ${headline}`;

      const res = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cfg.username ?? 'SignalKit',
          text: summary,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`Slack webhook failed: ${res.status} ${body}`);
      }
    },
  });
}
