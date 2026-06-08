// JSON-Schema emission — emitted from Zod via Zod v4 native z.toJSONSchema().
//
// Only the shapes that need Ajv runtime validation in consumers are emitted:
// ResumeDoc (pnpm validate / PUT /api/resume), Overlay (PUT /api/jobs/:id/overlay),
// MasterBank (grounding corpus validation). The renderer/API/pipeline import the
// Zod directly; these JSON Schemas exist for Ajv-based runtime gates.
import { z } from 'zod';
import { ResumeDoc } from './resume.js';
import { Overlay } from './overlay.js';
import { MasterBank } from './master.js';

/** The Zod schemas that get emitted as JSON Schema, keyed by output filename. */
export const JSON_SCHEMA_TARGETS = {
  resume: ResumeDoc,
  overlay: Overlay,
  master: MasterBank,
} as const;

export type JsonSchemaTarget = keyof typeof JSON_SCHEMA_TARGETS;

/**
 * Emit a single target's JSON Schema (draft 2020-12, via Zod v4 native).
 *
 * `io: 'input'` is deliberate: these schemas validate raw INPUT JSON in
 * consumers (e.g. PUT /api/resume receives a payload that has NOT been through
 * Zod's `.default()` filling). The default `io: 'output'` marks every defaulted
 * field as `required` (it is always present post-parse), which would wrongly
 * reject a valid input that omits a defaulted array. Input mode keeps defaulted/
 * optional fields non-required — what an Ajv runtime gate must accept.
 */
export function toJsonSchema(target: JsonSchemaTarget): unknown {
  return z.toJSONSchema(JSON_SCHEMA_TARGETS[target], { io: 'input' });
}

/** Emit all targets as a { name: jsonSchema } map. */
export function allJsonSchemas(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(JSON_SCHEMA_TARGETS) as JsonSchemaTarget[]) {
    out[name] = toJsonSchema(name);
  }
  return out;
}
