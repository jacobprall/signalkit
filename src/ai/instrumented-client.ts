import type { Logger } from 'pino';
import type { ZodSchema } from 'zod';
import {
  AnthropicAIClient,
  type AIAnalyzeOptions,
  type IAIClient,
  type TelemetryContext,
} from './client';

export class InstrumentedAIClient implements IAIClient {
  private context: TelemetryContext = {};

  constructor(
    private readonly inner: AnthropicAIClient,
    private readonly log: Logger,
  ) {}

  withContext(ctx: TelemetryContext): InstrumentedAIClient {
    const clone = new InstrumentedAIClient(this.inner, this.log);
    clone.context = { ...this.context, ...ctx };
    return clone;
  }

  async analyze<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: AIAnalyzeOptions,
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await this.inner.analyze(prompt, schema, options);
      const durationMs = Math.round(performance.now() - start);
      const usage = this.inner.lastUsage;

      this.log.info({
        event: 'llm_call',
        model: this.inner.modelName,
        durationMs,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        promptLength: prompt.length,
        retried: this.inner.lastRetried,
        success: true,
        ...this.context,
      });

      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);

      this.log.error({
        event: 'llm_call',
        model: this.inner.modelName,
        durationMs,
        promptLength: prompt.length,
        success: false,
        error: err instanceof Error ? err.message : String(err),
        ...this.context,
      });

      throw err;
    }
  }
}
