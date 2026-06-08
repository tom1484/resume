// Resume profiles: declarative section selections + filters over the
// canonical resume.json, defined in meta["x-profiles"].
import resume from './resume.json';
import { buildViewModels } from './adapter';

const viewModels = buildViewModels(resume);
const profileDefs = resume.meta['x-profiles'];

// Apply a declarative filter to a section's items. Items are identified by
// `title`. Precedence:
//  - `order` (explicit title list) selects exactly those items, in order,
//    ignoring tagsAnyOf/titleIn/limit;
//  - otherwise tagsAnyOf then titleIn narrow the set;
//  - `exclude` (title list) then drops items (applies in both branches);
//  - `limit` caps the count last (skipped when `order` is explicit).
function applyFilter(items, filter) {
  let result;
  if (filter.order) {
    const byTitle = new Map(items.map((item) => [item.title, item]));
    result = filter.order.map((title) => byTitle.get(title)).filter(Boolean);
  } else {
    result = items;
    if (filter.tagsAnyOf) {
      result = result.filter((item) => item.tags?.some((tag) => filter.tagsAnyOf.includes(tag)));
    }
    if (filter.titleIn) {
      result = result.filter((item) => filter.titleIn.includes(item.title));
    }
  }
  if (filter.exclude) {
    result = result.filter((item) => !filter.exclude.includes(item.title));
  }
  if (filter.limit != null && !filter.order) {
    result = result.slice(0, filter.limit);
  }
  return result;
}

// Build a profile from any set of view models (also used by overlay.js
// with view models rebuilt from a patched resume document)
export function buildProfileFrom(models, id, def) {
  const data = {};
  for (const sectionKey of def.sections) {
    const source = models[sectionKey];
    const filter = def.filters?.[sectionKey];
    data[sectionKey] = filter && Array.isArray(source) ? applyFilter(source, filter) : source;
  }
  return { id, name: def.name, description: def.description, data };
}

export const profiles = Object.fromEntries(
  Object.entries(profileDefs).map(([id, def]) => [id, buildProfileFrom(viewModels, id, def)])
);

export const DEFAULT_PROFILE = 'full';

export function getProfile(profileId) {
  const profile = profiles[profileId];
  if (!profile) {
    console.warn(`Profile "${profileId}" not found, falling back to full profile`);
    return profiles[DEFAULT_PROFILE];
  }
  return profile;
}

export function getProfileList() {
  return Object.values(profiles).map(({ id, name, description }) => ({ id, name, description }));
}
