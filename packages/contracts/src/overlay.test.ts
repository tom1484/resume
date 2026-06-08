import { describe, it, expect } from 'vitest';
import { Overlay } from './overlay.js';

// Regression: profile.filters must be a PARTIAL record over section keys.
// z.record(enumKey, …) is EXHAUSTIVE in Zod v4 (requires all 9 keys); the
// correct shape is z.partialRecord. overlayProblems() calls Overlay.safeParse,
// so an exhaustive record would reject every real (partially-filtered) overlay.
describe('Overlay.profile.filters — partialRecord', () => {
  const base = {
    jobId: 'j1',
    profile: { sections: ['personalInfo', 'projects'] as string[] },
    patches: [],
  };

  it('accepts a filter on a single section', () => {
    const r = Overlay.safeParse({
      ...base,
      profile: { ...base.profile, filters: { projects: { tagsAnyOf: ['ros'] } } },
    });
    expect(r.success).toBe(true);
  });

  it('accepts an overlay with no filters at all', () => {
    expect(Overlay.safeParse(base).success).toBe(true);
  });

  it('rejects a filter under a key outside the section registry', () => {
    const r = Overlay.safeParse({
      ...base,
      profile: { ...base.profile, filters: { bogus: { tagsAnyOf: ['x'] } } },
    });
    expect(r.success).toBe(false);
  });
});
