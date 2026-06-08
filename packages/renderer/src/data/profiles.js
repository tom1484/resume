// Resume profiles: declarative section selections + filters over the
// canonical resume.json, defined in meta["x-profiles"].
import resume from './resume.json';
import { buildViewModels } from './adapter';

const viewModels = buildViewModels(resume);
const profileDefs = resume.meta['x-profiles'];

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
