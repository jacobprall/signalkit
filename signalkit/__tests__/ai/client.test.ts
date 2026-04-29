import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MockAIClient } from '@/ai/client';

const TestSchema = z.object({
  name: z.string(),
  score: z.number(),
});

describe('MockAIClient', () => {
  it('returns configured response for matching prompt', async () => {
    const client = new MockAIClient();
    client.setResponse('analyze company', { name: 'Acme', score: 85 });

    const result = await client.analyze('Please analyze company XYZ', TestSchema);

    expect(result).toEqual({ name: 'Acme', score: 85 });
  });

  it('validates response against schema', async () => {
    const client = new MockAIClient();
    client.setResponse('weather', { name: 'Sunny', score: 10 });

    const result = await client.analyze('Check weather report', TestSchema);

    expect(result.name).toBe('Sunny');
    expect(typeof result.score).toBe('number');
  });

  it('throws on schema validation failure', async () => {
    const client = new MockAIClient();
    client.setResponse('bad data', { name: 123, score: 'not-a-number' });

    await expect(
      client.analyze('bad data prompt', TestSchema),
    ).rejects.toThrow();
  });

  it('throws when no matching response configured', async () => {
    const client = new MockAIClient();

    await expect(
      client.analyze('unknown prompt', TestSchema),
    ).rejects.toThrow('No mock response for prompt');
  });

  it('matches the first response whose key is contained in the prompt', async () => {
    const client = new MockAIClient();
    client.setResponse('careers', { name: 'Careers', score: 1 });
    client.setResponse('product', { name: 'Product', score: 2 });

    const result = await client.analyze('Analyze careers page', TestSchema);
    expect(result.name).toBe('Careers');
  });

  it('implements IAIClient interface', async () => {
    const client = new MockAIClient();
    client.setResponse('test', { name: 'T', score: 0 });

    const result = await client.analyze('test', TestSchema, { maxTokens: 1000 });
    expect(result.name).toBe('T');
  });
});
