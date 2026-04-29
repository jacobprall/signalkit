import { z } from 'zod';
import { defineDelivery } from '@/core/define-plugin';

export const EmailConfigSchema = z.object({
  to: z.string().email(),
  from: z.string().email().optional(),
  apiKey: z.string().optional(),
  apiUrl: z.string().url().default('https://api.resend.com/emails'),
});

export type EmailConfig = z.infer<typeof EmailConfigSchema>;

export type EmailFetcher = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export function createEmailDelivery(fetcher?: EmailFetcher) {
  const fetch = fetcher ?? (globalThis.fetch as unknown as EmailFetcher);

  return defineDelivery({
    name: 'email',

    async deliver(actionRun, company, config, _ctx) {
      const cfg = EmailConfigSchema.parse(config);
      const apiKey = cfg.apiKey ?? process.env.RESEND_API_KEY;

      if (!apiKey) {
        throw new Error('EmailDelivery requires apiKey or RESEND_API_KEY');
      }

      const output = (actionRun.output ?? {}) as Record<string, unknown>;
      const subject =
        (output.subject as string) ??
        `[SignalKit] ${actionRun.actionType} for ${company.name}`;
      const html = `<h2>${company.name}</h2><pre>${escapeHtml(JSON.stringify(output, null, 2))}</pre>`;

      const res = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: cfg.from ?? 'signalkit@example.com',
          to: cfg.to,
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`Email delivery failed: ${res.status} ${body}`);
      }
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
