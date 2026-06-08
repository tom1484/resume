// §4 Application overlay.
//
// Verdict: KEEP shape, REDESIGN encoding — port the overlay shape; encode the
// op-restriction and the reviewer-vs-LLM filter split IN THE TYPES, and validate
// profile.filters keys against §1.
// Two type-level gaps the brief calls out: (a) overlay.schema.json:71 allows all
// six RFC-6902 ops although LLM-authored patches are replace-only (tailor.js:39);
// (b) `filters` mixed LLM filters (tagsAnyOf/titleIn/limit) with reviewer filters
// (exclude/order) — only the reviewer emits exclude/order (editorModel.js:75-80),
// only the LLM emits tagsAnyOf/titleIn/limit (tailor.js:26-34). Encode both.
import { z } from 'zod';
import { SectionKey } from './sections.js';

// JSON-Pointer subset used by patches/from (v1: pattern ^(/|$)).
const Pointer = z.string().regex(/^(\/|$)/);

// Reviewer-only filter ops (editorModel.editorTreeToOverlay) — keyed by item title.
export const ReviewerFilter = z
  .object({
    exclude: z.array(z.string()).optional(), // hide these titles
    order: z.array(z.string()).optional(), // reorder by these titles
  })
  .strict();
export type ReviewerFilter = z.infer<typeof ReviewerFilter>;

// LLM-only filter ops (tailor TailorSchema → toOverlay).
export const LlmFilter = z
  .object({
    tagsAnyOf: z.array(z.string()).optional(),
    titleIn: z.array(z.string()).optional(),
    limit: z.number().int().min(0).optional(),
  })
  .strict();
export type LlmFilter = z.infer<typeof LlmFilter>;

// The persisted filter is the union (applyFilter consumes all five keys in the
// order tagsAnyOf→titleIn→exclude→order→limit, overlay.js:18-43). The split is
// enforced at the PRODUCER boundary (tailor emits only LlmFilter keys; the editor
// emits only ReviewerFilter keys) and re-checked by overlayProblems (§8).
export const OverlayFilter = z
  .object({
    ...ReviewerFilter.shape,
    ...LlmFilter.shape,
  })
  .strict();
export type OverlayFilter = z.infer<typeof OverlayFilter>;

// LLM-authored patch: replace-only, value is a string highlight, groundedIn ≥1.
// (groundedIn refs are bare `<id>` — see §11 flag; standardized on bare id.)
export const LlmPatch = z
  .object({
    op: z.literal('replace'),
    path: Pointer,
    value: z.string(),
    groundedIn: z.array(z.string()).min(1), // master-bank ids; stripped into audit by toOverlay
  })
  .strict();
export type LlmPatch = z.infer<typeof LlmPatch>;

// Persisted patch (after toOverlay strips groundedIn): RFC-6902-shaped but the
// pipeline only ever writes `replace`. Reviewer edits also produce replace-only
// whole-array highlight patches (editorModel.js:86).
export const Patch = z
  .object({
    op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']), // schema breadth (KEEP)
    path: Pointer,
    from: Pointer.optional(),
    value: z.unknown().optional(),
  })
  .strict();
export type Patch = z.infer<typeof Patch>;

export const AuditClaim = z
  .object({
    patchIndex: z.number().int().min(0),
    groundedIn: z.array(z.string()).optional(), // bare `<id>` — see §11
    verdict: z.enum(['supported', 'unsupported']),
  })
  .strict();
export type AuditClaim = z.infer<typeof AuditClaim>;

export const Audit = z
  .object({
    claims: z.array(AuditClaim).default([]),
    unsupported: z.array(z.number().int()).default([]), // MUST be [] at in_review (§11)
  })
  .strict();
export type Audit = z.infer<typeof Audit>;

export const Overlay = z
  .object({
    jobId: z.string().min(1),
    profile: z
      .object({
        name: z.string().optional(),
        description: z.string().optional(),
        sections: z.array(SectionKey).min(1), // §1 enum
        filters: z.record(SectionKey, OverlayFilter).optional(), // keys validated against §1
      })
      .strict(),
    patches: z.array(Patch).default([]),
    coverLetter: z.string().optional(),
    audit: Audit.optional(),
  })
  .strict();
export type Overlay = z.infer<typeof Overlay>;
