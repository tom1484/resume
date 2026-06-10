// Renderer section config: which component renders each section, its display
// title, and per-section props. Derived from the §1 SECTION_REGISTRY — the
// section KEYS and their order are NOT restated here (the registry is the one
// list). Only renderer-presentation facts that the registry does not carry live
// here: the component name, the displayed <Title> text, and real props.
//
// NOTE: the displayed title is intentionally NOT SECTION_REGISTRY.label — the
// rendered DOM must stay byte-identical, and the section headers are
// "Academic Experience" / "Work Experience" / "Competition Experience" /
// "Extracurricular", distinct from the registry's editor labels.
import { SECTION_REGISTRY } from '@resume/contracts';
import { SECTION_PROPS } from '@data';

interface SectionPresentation {
  id: string;
  component: 'PersonalInfo' | 'Education' | 'Experiences' | 'Publications' | 'Skills';
  /** Displayed section header (null = no header). Byte-stable. */
  title: string | null;
  /** Extra props passed to the component. */
  props: Record<string, unknown>;
}

// Per-section presentation, keyed by the §1 section key. Experience sections all
// render via the shared Experiences component; the `title` prop duplicates the
// header text.
const PRESENTATION: Record<string, SectionPresentation> = {
  personalInfo: { id: 'personal-info', component: 'PersonalInfo', title: null, props: {} },
  education: { id: 'education', component: 'Education', title: 'Education', props: {} },
  academics: { id: 'academic-experience', component: 'Experiences', title: 'Academic Experience', props: { title: 'Academic Experience' } },
  publications: { id: 'publications', component: 'Publications', title: 'Publications', props: {} },
  working: { id: 'working', component: 'Experiences', title: 'Work Experience', props: { title: 'Work Experience' } },
  competitions: { id: 'competition-experience', component: 'Experiences', title: 'Competition Experience', props: { title: 'Competition Experience' } },
  projects: { id: 'project-experience', component: 'Experiences', title: 'Projects', props: { title: 'Projects' } },
  extracurriculars: { id: 'extracurricular', component: 'Experiences', title: 'Extracurricular', props: { title: 'Extracurricular' } },
  skills: { id: 'skills', component: 'Skills', title: 'Skills', props: {} },
};

export interface SectionConfig extends SectionPresentation {
  enabled: boolean;
  dataKey: string;
}

// Build the config in the registry's declared order; dataKey === section key.
// `config` carries the one real renderer prop (projects.showTags); the
// Experiences component spreads `config` onto each item, so it must arrive under
// `config` (not as a top-level prop).
export const sectionsConfig: SectionConfig[] = SECTION_REGISTRY.map((s) => {
  const p = PRESENTATION[s.key];
  const config = SECTION_PROPS[s.key];
  return {
    ...p,
    enabled: true,
    dataKey: s.key,
    props: { ...p.props, ...(config ? { config } : {}) },
  };
});
