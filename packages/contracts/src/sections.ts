// §1 Section-key registry — THE one list.
//
// This single registry is the source for: the overlay `sections` enum, the
// TailorSchema sections enum, the editor section tree, the renderer
// sectionsConfig, the adapter's emitted keys, and sectionOrder validation.
import { z } from 'zod';

/**
 * The minimal structural shapes the split `pick` predicates read. The §1 split
 * discriminator is `track`/`kind` (§2). The `pick` predicates here are the
 * SINGLE place the split rule lives.
 */
export interface WorkPickInput {
  track?: 'academic' | 'industry';
}
export interface ProjectPickInput {
  kind?: 'competition' | 'project';
}

/** One section-registry entry. */
export interface SectionMeta {
  /** view-model / section key */
  readonly key: string;
  /** human label (editor + UI) */
  readonly label: string;
  /** résumé array this section draws from (null for synthesized sections) */
  readonly source: string | null;
  /** true ⇒ a list of items; false ⇒ a singleton (personalInfo/skills) */
  readonly list: boolean;
  /** true ⇒ bullets exposed in the editor + patch-targetable by tailoring */
  readonly editable: boolean;
  /** field items are keyed by for overlay exclude/order/filter */
  readonly titleKey?: string;
  /** splits one source array into two sections (the §1 split discriminator) */
  readonly pick?: (e: WorkPickInput & ProjectPickInput) => boolean;
}

/**
 * A view-model/section key. `source` is the résumé array it draws from (or null
 * for synthesized sections); `pick` splits one array into two sections;
 * `editable` exposes bullets in the editor + is patch-targetable by tailoring;
 * `titleKey` is the field items are keyed by for overlay exclude/order/filter.
 */
export const SECTION_REGISTRY = [
  { key: 'personalInfo',     label: 'Header',              source: 'basics',       list: false, editable: false },
  { key: 'education',        label: 'Education',           source: 'education',    list: true,  editable: false, titleKey: 'institution' },
  { key: 'academics',        label: 'Academic Experience', source: 'work',         list: true,  editable: true,  titleKey: 'name',        pick: (e) => e.track === 'academic' },
  { key: 'working',          label: 'Experience',          source: 'work',         list: true,  editable: true,  titleKey: 'name',        pick: (e) => e.track !== 'academic' },
  { key: 'publications',     label: 'Publications',        source: 'publications', list: true,  editable: false, titleKey: 'name' },
  { key: 'competitions',     label: 'Competitions',        source: 'projects',     list: true,  editable: true,  titleKey: 'name',        pick: (e) => e.kind === 'competition' },
  { key: 'projects',         label: 'Projects',            source: 'projects',     list: true,  editable: true,  titleKey: 'name',        pick: (e) => e.kind !== 'competition' },
  { key: 'extracurriculars', label: 'Activities',          source: 'volunteer',    list: true,  editable: true,  titleKey: 'organization' },
  { key: 'skills',           label: 'Skills',              source: 'skills',       list: false, editable: false },
] as const satisfies readonly SectionMeta[];

/** The nine keys, in renderer order: ['personalInfo', …, 'skills']. */
export const SECTION_KEYS = SECTION_REGISTRY.map((s) => s.key);

/** The ONE section-key enum, consumed by §2/§3/§4/§5. */
export const SectionKey = z.enum(
  SECTION_KEYS as unknown as [string, ...string[]]
);
export type SectionKey = z.infer<typeof SectionKey>;

/** Patch-targetable sections (editable bullets). */
export const EDITABLE_SECTION_KEYS = SECTION_REGISTRY.filter(
  (s) => s.editable
).map((s) => s.key);

/** Look up a registry entry by key. */
export const sectionMeta = (key: string): SectionMeta | undefined =>
  SECTION_REGISTRY.find((s) => s.key === key);
