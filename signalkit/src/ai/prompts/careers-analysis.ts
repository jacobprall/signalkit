import { z } from 'zod';

export const CareersAnalysisSchema = z.object({
  roles: z.array(
    z.object({
      title: z.string(),
      seniority: z.enum([
        'junior', 'mid', 'senior', 'lead',
        'manager', 'director', 'vp', 'unknown',
      ]),
      department: z.enum([
        'engineering', 'devops', 'infrastructure', 'platform',
        'data', 'design', 'product', 'marketing', 'sales', 'other',
      ]),
    }),
  ),
  has_devops: z.boolean(),
  has_infra: z.boolean(),
  mentions_heroku: z.boolean(),
  mentions_aws: z.boolean(),
  mentions_cloud_migration: z.boolean(),
  total_engineering_roles: z.number(),
});

export type CareersAnalysis = z.infer<typeof CareersAnalysisSchema>;

export function buildCareersPrompt(careersText: string): string {
  return `You are analyzing a startup's careers/jobs page to extract structured information about their hiring activity and infrastructure signals.

Analyze the following careers page text and extract:
1. All job roles listed (title, seniority level, department)
2. Whether they have DevOps/SRE roles open (has_devops)
3. Whether they have infrastructure/platform engineering roles (has_infra)
4. Whether Heroku is mentioned anywhere (mentions_heroku)
5. Whether AWS is mentioned (mentions_aws)
6. Whether cloud migration is mentioned (mentions_cloud_migration)
7. Total count of engineering-related roles (total_engineering_roles)

Respond with ONLY a JSON object matching this exact shape:
{
  "roles": [{"title": "...", "seniority": "...", "department": "..."}],
  "has_devops": boolean,
  "has_infra": boolean,
  "mentions_heroku": boolean,
  "mentions_aws": boolean,
  "mentions_cloud_migration": boolean,
  "total_engineering_roles": number
}

CAREERS PAGE TEXT:
${careersText}`;
}
