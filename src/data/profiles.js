// Multiple resume profiles support
import { personalInfo } from './personal_info';
import { education } from './education';
import { academics } from './experiences/academics';
import { internships } from './experiences/internships';
import { publications } from './publications';
import { competitions } from './experiences/competitions';
import { projects } from './experiences/projects';
import { extracurriculars } from './experiences/extracurricular';
import { skills } from './skills';

// Default full profile
export const fullProfile = {
  id: 'full',
  name: 'Full Resume',
  description: 'Complete resume with all sections',
  data: {
    personalInfo,
    education,
    academics,
    internships,
    publications,
    competitions,
    projects,
    extracurriculars,
    skills
  }
};

// Academic-focused profile
export const academicProfile = {
  id: 'academic',
  name: 'Academic Resume',
  description: 'Focus on research, publications, and academic experience',
  data: {
    personalInfo,
    education,
    academics,
    publications,
    projects: projects.filter(project => 
      project.tags?.some(tag => 
        ['Machine Learning', 'Computer Vision', 'Research'].includes(tag)
      )
    ),
    skills: skills.filter(skill => 
      ['Python', 'C++', 'MATLAB', 'Rust'].includes(skill.title)
    )
  }
};

// Industry-focused profile
export const industryProfile = {
  id: 'industry',
  name: 'Industry Resume',
  description: 'Focus on internships, projects, and technical skills',
  data: {
    personalInfo,
    education,
    internships,
    projects,
    competitions,
    skills
  }
};

// Minimal profile for quick overview
export const minimalProfile = {
  id: 'minimal',
  name: 'Minimal Resume',
  description: 'Essential information only',
  data: {
    personalInfo,
    education,
    projects: projects.slice(0, 3), // Top 3 projects
    skills: skills.filter(skill => 
      ['Python', 'C++', 'Rust', 'TypeScript', 'Full Stack'].includes(skill.title)
    )
  }
};

// All available profiles
export const profiles = {
  full: fullProfile,
  academic: academicProfile,
  industry: industryProfile,
  minimal: minimalProfile
};

// Get profile by ID
export function getProfile(profileId) {
  const profile = profiles[profileId];
  if (!profile) {
    console.warn(`Profile "${profileId}" not found, falling back to full profile`);
    return fullProfile;
  }
  return profile;
}

// Get all available profile metadata
export function getProfileList() {
  return Object.values(profiles).map(profile => ({
    id: profile.id,
    name: profile.name,
    description: profile.description
  }));
}

// Create custom profile from existing data
export function createCustomProfile(profileId, name, description, dataSelections) {
  const customData = {};
  
  // Build custom data based on selections
  for (const [dataKey, selection] of Object.entries(dataSelections)) {
    const sourceData = fullProfile.data[dataKey];
    if (!sourceData) continue;

    if (Array.isArray(sourceData)) {
      if (selection === 'all') {
        customData[dataKey] = sourceData;
      } else if (Array.isArray(selection)) {
        // Selection is array of indices or filter function
        if (typeof selection[0] === 'number') {
          customData[dataKey] = selection.map(index => sourceData[index]).filter(Boolean);
        } else {
          customData[dataKey] = sourceData.filter(selection[0]);
        }
      } else if (typeof selection === 'function') {
        customData[dataKey] = sourceData.filter(selection);
      } else if (typeof selection === 'number') {
        customData[dataKey] = sourceData.slice(0, selection);
      }
    } else {
      // For non-array data like personalInfo
      if (selection) {
        customData[dataKey] = sourceData;
      }
    }
  }

  return {
    id: profileId,
    name,
    description,
    data: customData,
    isCustom: true
  };
}

// Default profile ID
export const DEFAULT_PROFILE = 'full';