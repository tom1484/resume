// Anthropic client + structured-call helper with cost accounting.
// Bulk stages (parse_jd, score fit) run on Haiku per the approved cost plan
// (PROPOSALS.md §5: Haiku for bulk parsing/scoring, Sonnet/Opus for tailoring).
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

export const client = new Anthropic();

export const PARSE_MODEL = process.env.MODEL_PARSE ?? 'claude-haiku-4-5';

// $/MTok; cache read = 0.1x base input, cache write (5m) = 1.25x base input
const PRICES = {
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-opus-4-8': { in: 5, out: 25 },
};

export function costUsd(model, usage) {
  const p = PRICES[model];
  if (!p || !usage) return null;
  const inTok = usage.input_tokens ?? 0;
  const outTok = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  return (
    (inTok * p.in + outTok * p.out + cacheRead * p.in * 0.1 + cacheWrite * p.in * 1.25) / 1e6
  );
}

// One structured call: returns { output, usage, model, durationMs }.
// `system` blocks should put stable content first; pass cache: true to mark
// the system prompt as a cache breakpoint (min ~1024 tokens to actually cache).
export async function structuredCall({ model = PARSE_MODEL, system, user, schema, maxTokens = 2048, cache = false }) {
  const started = Date.now();
  const response = await client.messages.parse({
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: system,
        ...(cache ? { cache_control: { type: 'ephemeral' } } : {}),
      },
    ],
    messages: [{ role: 'user', content: user }],
    output_config: { format: zodOutputFormat(schema) },
  });
  if (response.parsed_output == null) {
    throw new Error(`structured call returned unparseable output (${model})`);
  }
  return {
    output: response.parsed_output,
    usage: response.usage,
    model,
    durationMs: Date.now() - started,
  };
}
