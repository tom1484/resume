import type { ComponentType } from 'react';
import PersonalInfo from '@components/personalInfo';
import Education from '@components/education';
import Experiences from '@components/experiences';
import Publications from '@components/publications';
import Skills from '@components/skills';

export const componentRegistry: Record<string, ComponentType<Record<string, unknown>>> = {
  PersonalInfo: PersonalInfo as ComponentType<Record<string, unknown>>,
  Education: Education as ComponentType<Record<string, unknown>>,
  Experiences: Experiences as ComponentType<Record<string, unknown>>,
  Publications: Publications as ComponentType<Record<string, unknown>>,
  Skills: Skills as ComponentType<Record<string, unknown>>,
};

export const getComponent = (
  componentName: string
): ComponentType<Record<string, unknown>> | null => {
  const Component = componentRegistry[componentName];
  if (!Component) {
    // eslint-disable-next-line no-console
    console.warn(`Component "${componentName}" not found in registry`);
    return null;
  }
  return Component;
};
