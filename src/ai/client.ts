import Anthropic from '@anthropic-ai/sdk';
import type { ZodSchema } from 'zod';

export interface AIAnalyzeOptions {
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
}

export interface AIUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface TelemetryContext {
  readonly action?: string;
  readonly companyId?: string;
  readonly [key: string]: unknown;
}

export interface IAIClient {
  analyze<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: AIAnalyzeOptions,
  ): Promise<T>;

  withContext?(ctx: TelemetryContext): IAIClient;
}

export interface AnthropicAIOptions {
  apiKey?: string;
  model?: string;
  defaultMaxTokens?: number;
  defaultTimeoutMs?: number;
}

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 60_000;

interface CompletionResult {
  text: string;
  usage: AIUsage;
}

export class AnthropicAIClient implements IAIClient {
  private readonly client: Anthropic;
  readonly modelName: string;
  private readonly defaultMaxTokens: number;
  private readonly defaultTimeoutMs: number;

  private _lastUsage: AIUsage | null = null;
  private _retried = false;

  get lastUsage(): AIUsage | null {
    return this._lastUsage;
  }

  get lastRetried(): boolean {
    return this._retried;
  }

  constructor(options: AnthropicAIOptions = {}) {
    const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'AnthropicAIClient requires apiKey or ANTHROPIC_API_KEY env var',
      );
    }
    this.client = new Anthropic({ apiKey });
    this.modelName =
      options.model ??
      process.env.ANTHROPIC_MODEL ??
      'claude-sonnet-4-20250514';
    this.defaultMaxTokens = options.defaultMaxTokens ?? DEFAULT_MAX_TOKENS;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async analyze<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: AIAnalyzeOptions,
  ): Promise<T> {
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;

    this._retried = false;
    const raw = await this.requestCompletion(prompt, maxTokens, timeoutMs);
    this._lastUsage = raw.usage;

    const first = this.tryParse(raw.text, schema);
    if (first.success) return first.data;

    this._retried = true;
    const retryPrompt = `${prompt}

Your previous response was not valid JSON or did not match the required schema.
Error: ${first.error}

Please respond with ONLY a valid JSON object. No prose, no markdown fences, no explanation.`;
    const retryRaw = await this.requestCompletion(retryPrompt, maxTokens, timeoutMs);
    this._lastUsage = {
      inputTokens: raw.usage.inputTokens + retryRaw.usage.inputTokens,
      outputTokens: raw.usage.outputTokens + retryRaw.usage.outputTokens,
    };

    const second = this.tryParse(retryRaw.text, schema);
    if (second.success) return second.data;

    throw new Error(
      `AI response failed schema validation after retry: ${second.error}`,
    );
  }

  private async requestCompletion(
    prompt: string,
    maxTokens: number,
    timeoutMs: number,
  ): Promise<CompletionResult> {
    const message = await Promise.race([
      this.client.messages.create({
        model: this.modelName,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`AI request timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);

    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in AI response');
    }

    return {
      text: textBlock.text,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }

  private tryParse<T>(
    raw: string,
    schema: ZodSchema<T>,
  ): { success: true; data: T } | { success: false; error: string } {
    try {
      const json = extractJsonObject(raw);
      if (json === null) {
        return { success: false, error: 'No JSON object found in response' };
      }
      const validated = schema.parse(json);
      return { success: true, data: validated };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* fall through */
    }
  }

  const balanced = findFirstBalancedObject(trimmed);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch {
      /* fall through */
    }
  }
  return null;
}

function findFirstBalancedObject(s: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth === 0) continue;
      depth--;
      if (depth === 0 && start !== -1) {
        return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

export class MockAIClient implements IAIClient {
  private exact: Map<string, unknown> = new Map();
  private matchers: Array<{ test: (prompt: string) => boolean; response: unknown }> = [];

  setResponse(promptContains: string, response: unknown): void {
    this.matchers.push({
      test: (p) => p.includes(promptContains),
      response,
    });
  }

  setExact(prompt: string, response: unknown): void {
    this.exact.set(prompt, response);
  }

  setMatcher(predicate: (prompt: string) => boolean, response: unknown): void {
    this.matchers.push({ test: predicate, response });
  }

  async analyze<T>(
    prompt: string,
    schema: ZodSchema<T>,
    _options?: AIAnalyzeOptions,
  ): Promise<T> {
    if (this.exact.has(prompt)) {
      return schema.parse(this.exact.get(prompt));
    }
    for (const m of this.matchers) {
      if (m.test(prompt)) {
        return schema.parse(m.response);
      }
    }
    throw new Error('No mock response for prompt');
  }
}
