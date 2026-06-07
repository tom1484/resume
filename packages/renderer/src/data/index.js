import { getProfile, getProfileList, DEFAULT_PROFILE } from './profiles';
import { applyOverlay } from './overlay';

export { getProfileList };

// Active application overlay profile (set via registerApplication before
// React mounts — see apps/site/src/index.jsx). When set, it pins the
// rendered profile; ?profile= and the config panel are bypassed.
let applicationProfile = null;

export const registerApplication = (overlay) => {
  applicationProfile = applyOverlay(overlay);
  return applicationProfile;
};

// Per-section presentation configs (consumed by config/sections.js)
export const experienceConfigs = {
  academics: {},
  working: {},
  competitions: {},
  projects: {
    showTags: false,
  },
  extracurriculars: {},
};

export const publicationsConfig = {};

// Current active profile; can be preselected via ?profile=<id> in the URL
// (used by scripts/print-pdf.mjs to render per-profile PDFs)
let currentProfileId = (() => {
  if (typeof window !== 'undefined') {
    const requested = new URLSearchParams(window.location.search).get('profile');
    if (requested && getProfileList().some((p) => p.id === requested)) {
      return requested;
    }
  }
  return DEFAULT_PROFILE;
})();

// Get current resume data (view models) based on active profile
export const getResumeData = () => {
  if (applicationProfile) return applicationProfile.data;
  return getProfile(currentProfileId).data;
};

// Get data for a specific key
export const getData = (dataKey, options = {}) => {
  const data = getResumeData()[dataKey];

  if (!data) {
    console.warn(`Data key "${dataKey}" not found in resume data`);
    return null;
  }

  return data;
};

// Switch to a different profile
export const switchProfile = (profileId) => {
  const profile = getProfile(profileId);
  if (profile) {
    currentProfileId = profileId;
    console.log(`Switched to profile: ${profile.name}`);
    return true;
  }
  return false;
};

// Get current profile info
export const getCurrentProfile = () => {
  if (applicationProfile) return applicationProfile;
  return getProfile(currentProfileId);
};

// Lightweight structural validation of the active profile's view models.
// Full JSON Resume schema validation runs in Node via `pnpm validate`
// (scripts/validate.mjs) so Ajv stays out of the browser bundle.
export const validateCurrentData = () => {
  const resumeData = getResumeData();
  const errors = {};

  for (const [key, value] of Object.entries(resumeData)) {
    const sectionErrors = [];
    if (Array.isArray(value)) {
      if (value.length === 0) {
        sectionErrors.push(`${key} has no items`);
      }
      value.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          sectionErrors.push(`${key}[${index}] is not an object`);
        } else if (!item.title) {
          sectionErrors.push(`${key}[${index}] is missing a title`);
        }
      });
    } else if (key === 'personalInfo') {
      if (!Array.isArray(value.info) || value.info.length === 0) {
        sectionErrors.push('personalInfo.info is missing or empty');
      }
      if (!Array.isArray(value.link)) {
        sectionErrors.push('personalInfo.link is missing');
      }
    }
    if (sectionErrors.length > 0) {
      errors[key] = sectionErrors;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Get data with validation
export const getValidatedData = (dataKey, options = {}) => {
  const data = getData(dataKey, options);

  if (data && options.validate) {
    const validation = validateCurrentData();
    if (!validation.isValid && validation.errors[dataKey]) {
      console.warn(`Validation errors for ${dataKey}:`, validation.errors[dataKey]);
      if (options.throwOnValidationError) {
        throw new Error(`Invalid data for ${dataKey}: ${validation.errors[dataKey].join(', ')}`);
      }
    }
  }

  return data;
};
