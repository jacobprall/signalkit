import { z } from 'zod';
import { defineDelivery } from '@/core/define-plugin';

export const ClayConfigSchema = z.object({
  webhookUrl: z.string().url(),
  authToken: z.string().optional(),
});

export type ClayConfig = z.infer<typeof ClayConfigSchema>;

export type ClayFetcher = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

function extractHeadline(
  actionType: string,
  output: Record<string, unknown>,
  companyName: string,
): string {
  const summary = output.summary as string | undefined;
  const subject = output.subject as string | undefined;
  const changeDescription = output.change_description as string | undefined;
  const recommendation = output.recommendation as string | undefined;

  return (
    summary ??
    subject ??
    changeDescription ??
    recommendation ??
    `New ${actionType} for ${companyName}`
  );
}

function signalkitCompanyUrl(companyId: string): string | undefined {
  const base = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!base) return undefined;
  try {
    const u = new URL(base);
    u.pathname = `/companies/${companyId}`;
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return undefined;
  }
}

export function createClayDelivery(fetcher?: ClayFetcher) {
  const fetch = fetcher ?? (globalThis.fetch as unknown as ClayFetcher);

  return defineDelivery({
    name: 'clay',

    async deliver(actionRun, company, config, _ctx) {
      const cfg = ClayConfigSchema.parse(config);
      const output = (actionRun.output ?? {}) as Record<string, unknown>;

      const payload: Record<string, unknown> = {
        company_name: company.name,
        company_domain: company.domain ?? null,
        company_url: company.websiteUrl ?? null,
        action_type: actionRun.actionType,
        headline: extractHeadline(actionRun.actionType, output, company.name),
        output,
        signalkit_action_run_id: actionRun.id,
        completed_at: actionRun.completedAt?.toISOString() ?? null,
      };

      const dashboardUrl = signalkitCompanyUrl(company.id);
      if (dashboardUrl) {
        payload.signalkit_company_url = dashboardUrl;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (cfg.authToken) {
        headers.Authorization = `Bearer ${cfg.authToken}`;
      }

      const res = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '<no body>');
        throw new Error(`Clay webhook failed: ${res.status} ${body}`);
      }
    },
  });
}
