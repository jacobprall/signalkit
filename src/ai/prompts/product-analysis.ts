import { z } from 'zod';

export const ProductAnalysisSchema = z.object({
  description: z.string(),
  category: z.string(),
  likely_stack: z.array(z.string()),
  complexity: z.enum(['simple', 'moderate', 'complex']),
  is_b2b: z.boolean(),
  is_developer_tool: z.boolean(),
});

export type ProductAnalysis = z.infer<typeof ProductAnalysisSchema>;

export const TechStackSchema = z.object({
  detected: z.array(z.string()),
  source: z.enum(['careers', 'homepage', 'login', 'combined']),
  has_backend: z.boolean(),
  has_frontend: z.boolean(),
  has_mobile: z.boolean(),
});

export type TechStack = z.infer<typeof TechStackSchema>;

export function buildProductPrompt(
  homepageText: string,
  loginText?: string,
): string {
  let pageContent = `HOMEPAGE TEXT:\n${homepageText}`;

  if (loginText) {
    pageContent += `\n\nLOGIN PAGE TEXT:\n${loginText}`;
  }

  return `You are analyzing a startup's website to understand their product and technical profile.

Analyze the following page content and extract:
1. A brief product description
2. Product category (e.g., DevTools, Analytics, Security, FinTech, etc.)
3. Likely technology stack based on clues in the content
4. Product complexity (simple, moderate, complex)
5. Whether this is a B2B product
6. Whether this is a developer tool

Respond with ONLY a JSON object matching this exact shape:
{
  "description": "...",
  "category": "...",
  "likely_stack": ["tech1", "tech2"],
  "complexity": "simple" | "moderate" | "complex",
  "is_b2b": boolean,
  "is_developer_tool": boolean
}

${pageContent}`;
}

export function buildTechStackPrompt(
  allPageTexts: { type: string; text: string }[],
): string {
  const pagesContent = allPageTexts
    .map((page) => `--- ${page.type.toUpperCase()} PAGE ---\n${page.text}`)
    .join('\n\n');

  const source =
    allPageTexts.length > 1
      ? 'combined'
      : allPageTexts[0]?.type ?? 'homepage';

  return `You are analyzing a startup's website pages to detect their technology stack.

Look for clues about technologies used: frameworks, languages, databases, cloud providers, third-party services, and infrastructure mentioned in job postings, page source hints, or product descriptions.

Respond with ONLY a JSON object matching this exact shape:
{
  "detected": ["tech1", "tech2", "tech3"],
  "source": "${source}",
  "has_backend": boolean,
  "has_frontend": boolean,
  "has_mobile": boolean
}

PAGE CONTENT:
${pagesContent}`;
}
