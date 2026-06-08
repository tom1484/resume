// Application overlay engine (§4): turns a per-job overlay (section selection +
// per-section filters + RFC-6902 patches) into a renderable profile. The
// canonical résumé document is NEVER mutated — patches are applied to a deep
// clone, then view models are rebuilt from the patched document and assembled
// by buildProfileFrom. Operates on view models (title/tags), so it is unchanged
// by the §2 field reshape.
import jsonpatch, { type Operation } from 'fast-json-patch';
import type { Overlay, OverlayFilter, ResumeDoc, ViewModels } from '@resume/contracts';
import bundledResume from '../../../../data/resume.json' with { type: 'json' };
import { buildViewModels } from './adapter.js';

const seed = bundledResume as unknown as ResumeDoc;

type VMItem = { title?: string; tags?: string[] };

export interface Profile {
  id: string;
  name?: string;
  description?: string;
  data: Partial<Record<keyof ViewModels, unknown>>;
}

interface ProfileDef {
  name?: string;
  description?: string;
  sections: string[];
  filters?: Partial<Record<string, OverlayFilter>>;
}

// Apply a declarative filter to a section's items. Items are keyed by their
// `title` (company / project / institution name — what the adapter emits).
//   tagsAnyOf : keep items having any of these tags
//   titleIn   : keep only these titles
//   exclude   : drop these titles (reviewer "hide item" — overrides the rest)
//   order     : reorder by this title list; unlisted items keep their relative
//               order, after the listed ones
//   limit     : cap count (applied last)
function applyFilter<T extends VMItem>(items: T[], filter: OverlayFilter): T[] {
  let result = items;
  if (filter.tagsAnyOf) {
    const anyOf = filter.tagsAnyOf;
    result = result.filter((item) => item.tags?.some((tag) => anyOf.includes(tag)));
  }
  if (filter.titleIn) {
    const titleIn = filter.titleIn;
    result = result.filter((item) => titleIn.includes(item.title as string));
  }
  if (filter.exclude) {
    const exclude = filter.exclude;
    result = result.filter((item) => !exclude.includes(item.title as string));
  }
  if (filter.order) {
    const order = filter.order;
    const rank = (item: T) => {
      const i = order.indexOf(item.title as string);
      return i === -1 ? order.length : i;
    };
    result = result
      .map((item, i) => [item, i] as const)
      .sort(([a, ai], [b, bi]) => rank(a) - rank(b) || ai - bi)
      .map(([item]) => item);
  }
  if (filter.limit != null) {
    result = result.slice(0, filter.limit);
  }
  return result;
}

// Build a profile from a set of view models + a definition {sections, filters}.
export function buildProfileFrom(
  models: ViewModels,
  id: string,
  def: ProfileDef
): Profile {
  const data: Record<string, unknown> = {};
  for (const sectionKey of def.sections) {
    const source = (models as Record<string, unknown>)[sectionKey];
    const filter = def.filters?.[sectionKey];
    data[sectionKey] =
      filter && Array.isArray(source)
        ? applyFilter(source as VMItem[], filter)
        : source;
  }
  return { id, name: def.name, description: def.description, data };
}

// Apply an overlay to a résumé document; returns { id, name, description, data }.
// Throws on a patch that doesn't apply cleanly or an unknown section key.
export function applyOverlay(
  overlay: Overlay,
  resumeDoc: ResumeDoc = seed
): Profile {
  const patches = (overlay.patches ?? []) as Operation[];
  const patchError = jsonpatch.validate(patches, resumeDoc);
  if (patchError) {
    throw new Error(
      `overlay ${overlay.jobId}: patch #${patchError.index} (${patchError.name}) does not apply at ${patchError.operation?.path}`
    );
  }
  const patched = jsonpatch.applyPatch(jsonpatch.deepClone(resumeDoc), patches)
    .newDocument as ResumeDoc;
  const models = buildViewModels(patched);

  for (const sectionKey of overlay.profile.sections) {
    if (!(sectionKey in models)) {
      throw new Error(`overlay ${overlay.jobId}: unknown section "${sectionKey}"`);
    }
  }

  return buildProfileFrom(models, `application:${overlay.jobId}`, {
    name: overlay.profile.name ?? `Application ${overlay.jobId}`,
    description: overlay.profile.description,
    sections: overlay.profile.sections,
    filters: overlay.profile.filters,
  });
}
