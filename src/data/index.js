import { getProfile, DEFAULT_PROFILE } from './profiles';
import { validateResumeData } from './validation';
import { DataTransformer } from './transformers';

// Current active profile
let currentProfileId = DEFAULT_PROFILE;

// Get current resume data based on active profile
export const getResumeData = () => {
  const profile = getProfile(currentProfileId);
  return profile.data;
};

// Get data for a specific key with optional transformations
export const getData = (dataKey, options = {}) => {
  const resumeData = getResumeData();
  let data = resumeData[dataKey];
  
  if (!data) {
    console.warn(`Data key "${dataKey}" not found in resume data`);
    return null;
  }
  
  // Apply transformations if requested
  if (options.transform) {
    switch (dataKey) {
      case 'personalInfo':
        data = DataTransformer.transformPersonalInfo(data);
        break;
      case 'education':
        data = DataTransformer.transformEducation(data);
        break;
      case 'publications':
        data = data.map(item => DataTransformer.transformPublication(item));
        break;
      case 'skills':
        data = DataTransformer.transformSkills(data);
        break;
      default:
        // For experience-type data
        if (Array.isArray(data)) {
          data = data.map(item => DataTransformer.transformExperience(item));
        }
        break;
    }
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
  return getProfile(currentProfileId);
};

// Validate current resume data
export const validateCurrentData = () => {
  const resumeData = getResumeData();
  return validateResumeData(resumeData);
};

// Get data with validation
export const getValidatedData = (dataKey, options = {}) => {
  const data = getData(dataKey, options);
  
  if (data && options.validate) {
    try {
      const validation = validateCurrentData();
      if (!validation.isValid && validation.errors[dataKey]) {
        console.warn(`Validation errors for ${dataKey}:`, validation.errors[dataKey]);
        if (options.throwOnValidationError) {
          throw new Error(`Invalid data for ${dataKey}: ${validation.errors[dataKey].join(', ')}`);
        }
      }
    } catch (error) {
      console.error(`Validation failed for ${dataKey}:`, error);
      if (options.throwOnValidationError) {
        throw error;
      }
    }
  }
  
  return data;
};

// Load data dynamically (for future async data loading)
export const loadData = async (dataKey, source = 'default') => {
  // For now, just return synchronous data
  // Future: could load from API, local storage, etc.
  switch (source) {
    case 'localStorage':
      try {
        const stored = localStorage.getItem(`resume-${dataKey}`);
        return stored ? JSON.parse(stored) : getData(dataKey);
      } catch {
        return getData(dataKey);
      }
    case 'default':
    default:
      return getData(dataKey);
  }
};

// Save data to storage (for future persistence)
export const saveData = async (dataKey, data, destination = 'localStorage') => {
  switch (destination) {
    case 'localStorage':
      try {
        localStorage.setItem(`resume-${dataKey}`, JSON.stringify(data));
        return true;
      } catch (error) {
        console.error(`Failed to save ${dataKey} to localStorage:`, error);
        return false;
      }
    default:
      console.warn(`Unknown save destination: ${destination}`);
      return false;
  }
};

// Legacy exports for backward compatibility
export const resumeData = getResumeData();