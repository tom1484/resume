// Anthropic client + structured-call helper with cost accounting.
// Bulk stages (parse_jd, score fit, verify) run on Haiku; tailoring on
// Sonnet/Opus — but the model per stage now comes from LlmConfig (§6), not env.
// costUsd/PRICES are re-exported from @resume/contracts (the one pricing table).
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ZodType } from 'zod';
import { costUsd, PRICES, type Usage } from '@resume/contracts';

export { costUsd, PRICES };
export type { Usage };

export const client = new Anthropic();

// Default model only as a last-resort fallback when a caller omits one; live
// stages pass the model from LlmConfig.models.* (getConfig('llm')).
export const DEFAULT_MODEL = 'claude-haiku-4-5';

export interface StructuredCallArgs<T> {
  model?: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens?: number;
  cache?: boolean;
}

export interface StructuredCallResult<T> {
  output: T;
  usage: Usage;
  model: string;
  durationMs: number;
}

// One structured call: returns { output, usage, model, durationMs }.
// `system` blocks should put stable content first; pass cache: true to mark
// the system prompt as a cache breakpoint (min ~1024 tokens to actually cache).
export async function structuredCall<T>({
  model = DEFAULT_MODEL,
  system,
  user,
  schema,
  maxTokens = 2048,
  cache = false,
}: StructuredCallArgs<T>): Promise<StructuredCallResult<T>> {
  const started = Date.now();
  const response = await client.messages.parse({
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: system,
        ...(cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
      },
    ],
    messages: [{ role: 'user', content: user }],
    output_config: { format: zodOutputFormat(schema) },
  });
  if (response.parsed_output == null) {
    throw new Error(`structured call returned unparseable output (${model})`);
  }
  return {
    output: response.parsed_output as T,
    usage: response.usage as Usage,
    model,
    durationMs: Date.now() - started,
  };
}
