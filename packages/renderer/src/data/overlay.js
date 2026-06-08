// Application overlay engine: turns a per-job overlay (section selection +
// per-section filters + RFC-6902 patches, see overlay.schema.json) into a
// renderable profile. The canonical resume document is NEVER mutated —
// patches are applied to a deep clone, then view models are rebuilt from the
// patched document and assembled by buildProfileFrom (below).
import jsonpatch from 'fast-json-patch';
import resume from '../../../../data/resume.json';
import { buildViewModels } from './adapter';

// Apply a declarative filter to a section's items. Items are keyed by their
// `title` (company / project / institution name — what the adapter emits).
//   tagsAnyOf : keep items having any of these tags
//   titleIn   : keep only these titles
//   exclude   : drop these titles (reviewer "hide item" — overrides the rest)
//   order     : reorder by this title list; unlisted items keep their
//               relative order, after the listed ones
//   limit     : cap count (applied last)
function applyFilter(items, filter) {
  let result = items;
  if (filter.tagsAnyOf) {
    result = result.filter((item) => item.tags?.some((tag) => filter.tagsAnyOf.includes(tag)));
  }
  if (filter.titleIn) {
    result = result.filter((item) => filter.titleIn.includes(item.title));
  }
  if (filter.exclude) {
    result = result.filter((item) => !filter.exclude.includes(item.title));
  }
  if (filter.order) {
    const rank = (item) => {
      const i = filter.order.indexOf(item.title);
      return i === -1 ? filter.order.length : i;
    };
    result = result
      .map((item, i) => [item, i])
      .sort(([a, ai], [b, bi]) => rank(a) - rank(b) || ai - bi)
      .map(([item]) => item);
  }
  if (filter.limit != null) {
    result = result.slice(0, filter.limit);
  }
  return result;
}

// Build a profile from a set of view models + a definition {sections, filters}.
// (Profile *variants* were removed — this now serves only the overlay's
// per-job section selection + item filtering.)
export function buildProfileFrom(models, id, def) {
  const data = {};
  for (const sectionKey of def.sections) {
    const source = models[sectionKey];
    const filter = def.filters?.[sectionKey];
    data[sectionKey] = filter && Array.isArray(source) ? applyFilter(source, filter) : source;
  }
  return { id, name: def.name, description: def.description, data };
}

// Apply an overlay to a resume document; returns { id, name, description, data }.
// Throws on a patch that doesn't apply cleanly or an unknown section key.
export function applyOverlay(overlay, resumeDoc = resume) {
  const patches = overlay.patches ?? [];
  const patchError = jsonpatch.validate(patches, resumeDoc);
  if (patchError) {
    throw new Error(
      `overlay ${overlay.jobId}: patch #${patchError.index} (${patchError.name}) does not apply at ${patchError.operation?.path}`
    );
  }
  const patched = jsonpatch.applyPatch(jsonpatch.deepClone(resumeDoc), patches).newDocument;
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
