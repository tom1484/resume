// Resume profiles: declarative section selections + filters over the
// canonical resume.json, defined in meta["x-profiles"].
import resume from './resume.json';
import { buildViewModels } from './adapter';

const viewModels = buildViewModels(resume);
const profileDefs = resume.meta['x-profiles'];

// Apply a declarative filter to a section's items
function applyFilter(items, filter) {
  let result = items;
  if (filter.tagsAnyOf) {
    result = result.filter((item) => item.tags?.some((tag) => filter.tagsAnyOf.includes(tag)));
  }
  if (filter.titleIn) {
    result = result.filter((item) => filter.titleIn.includes(item.title));
  }
  if (filter.limit != null) {
    result = result.slice(0, filter.limit);
  }
  return result;
}

function buildProfile(id, def) {
  const data = {};
  for (const sectionKey of def.sections) {
    const source = viewModels[sectionKey];
    const filter = def.filters?.[sectionKey];
    data[sectionKey] = filter && Array.isArray(source) ? applyFilter(source, filter) : source;
  }
  return { id, name: def.name, description: def.description, data };
}

export const profiles = Object.fromEntries(
  Object.entries(profileDefs).map(([id, def]) => [id, buildProfile(id, def)])
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
