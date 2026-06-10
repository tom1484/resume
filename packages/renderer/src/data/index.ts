// Data layer for the renderer. Components do not read module globals at render
// time. Instead the render host computes the renderable payload (résumé doc +
// view models) and passes it down through `ResumeDataProvider`
// (contexts/resumeDataContext); components read it via the
// `useResumeData`/`useSection` hooks. This file is pure helpers + the bundled
// seed fallback.
import type { ResumeDoc, ViewModels } from '@resume/contracts';
import bundledResume from '../../../../data/resume.json' with { type: 'json' };
import { buildViewModels } from './adapter.js';
import { applyOverlay, type Profile } from './overlay.js';
import type { Overlay } from '@resume/contracts';

/** The bundled résumé seed — fallback for standalone/PDF/CI builds with no API. */
export const bundledSeed = bundledResume as unknown as ResumeDoc;

// Per-section presentation config (the one real renderer prop: projects.showTags).
export const SECTION_PROPS: Record<string, { showTags?: boolean }> = {
  projects: { showTags: false },
};

/** What the render host hands to the provider: the doc + its view models. */
export interface RenderPayload {
  doc: ResumeDoc;
  data: ViewModels | Profile['data'];
}

/** Build the renderable payload for the canonical résumé (or an edited doc). */
export const resumePayload = (doc: ResumeDoc = bundledSeed): RenderPayload => ({
  doc,
  data: buildViewModels(doc),
});

/**
 * Build the renderable payload for an application overlay against a base résumé.
 * `doc` is the base résumé so meta (print config, etc.) is inherited by the
 * render; `data` is the overlay-selected/filtered subset of view models.
 */
export const applicationPayload = (
  overlay: Overlay,
  baseDoc: ResumeDoc = bundledSeed
): RenderPayload => ({
  doc: baseDoc,
  data: applyOverlay(overlay, baseDoc).data,
});

export { buildViewModels } from './adapter.js';
export { applyOverlay, buildProfileFrom } from './overlay.js';
export type { Profile } from './overlay.js';
export { getPrint, pageCss, pdfOptions, PRINT_DEFAULTS, PAPER_SIZES } from './print.js';
export type { PrintSettings } from './print.js';
export {
  buildEditorModel,
  editorTreeToOverlay,
  treeToResume,
} from './editorModel.js';
export type {
  EditorTree,
  SectionNode,
  ItemNode,
  BulletNode,
} from './editorModel.js';
