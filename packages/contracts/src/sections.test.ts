import { describe, it, expect } from 'vitest';
import {
  SECTION_KEYS,
  SectionKey,
  EDITABLE_SECTION_KEYS,
  SECTION_REGISTRY,
  sectionMeta,
} from './sections.js';

describe('section registry (§1)', () => {
  it('SECTION_KEYS equals the 9 keys in order', () => {
    expect(SECTION_KEYS).toEqual([
      'personalInfo',
      'education',
      'academics',
      'working',
      'publications',
      'competitions',
      'projects',
      'extracurriculars',
      'skills',
    ]);
  });

  it('SectionKey.parse accepts each known key', () => {
    for (const k of SECTION_KEYS) {
      expect(SectionKey.parse(k)).toBe(k);
    }
  });

  it('SectionKey.parse rejects an unknown key', () => {
    expect(() => SectionKey.parse('summary')).toThrow();
    expect(() => SectionKey.parse('')).toThrow();
  });

  it('EDITABLE_SECTION_KEYS are exactly the editable sections', () => {
    expect(EDITABLE_SECTION_KEYS).toEqual([
      'academics',
      'working',
      'competitions',
      'projects',
      'extracurriculars',
    ]);
  });

  it('the split predicates are the single place the split lives', () => {
    const academics = sectionMeta('academics');
    const working = sectionMeta('working');
    const competitions = sectionMeta('competitions');
    const projects = sectionMeta('projects');
    expect(academics?.pick?.({ track: 'academic' })).toBe(true);
    expect(academics?.pick?.({ track: 'industry' })).toBe(false);
    expect(working?.pick?.({ track: 'academic' })).toBe(false);
    expect(working?.pick?.({})).toBe(true); // absent ⇒ working
    expect(competitions?.pick?.({ kind: 'competition' })).toBe(true);
    expect(projects?.pick?.({ kind: 'competition' })).toBe(false);
    expect(projects?.pick?.({})).toBe(true); // absent ⇒ project
  });

  it('registry covers all 9 keys', () => {
    expect(SECTION_REGISTRY).toHaveLength(9);
  });
});
