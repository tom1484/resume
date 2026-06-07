import PersonalInfo from '@components/personalInfo';
import Education from '@components/education';
import Experiences from '@components/experiences';
import Publications from '@components/publications';
import Skills from '@components/skills';

export const componentRegistry = {
  PersonalInfo,
  Education,
  Experiences,
  Publications,
  Skills
};

export const getComponent = (componentName) => {
  const Component = componentRegistry[componentName];
  if (!Component) {
    console.warn(`Component "${componentName}" not found in registry`);
    return null;
  }
  return Component;
};