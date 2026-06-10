// Deterministic scoring math (no LLM, no DB): keyword coverage + the two-list
// Constraints evaluation (citizenship -> hard 0; complementary penalties;
// clamp >=0).
import { describe, expect, it } from 'vitest';
import type { Constraint, JdSchema, LlmConfig } from '@resume/contracts';
import {
  combine,
  keywordScore,
  levenshtein,
  evaluateConstraints,
  termMatches,
} from './score.js';

const WEIGHTS: LlmConfig['weights'] = { keyword: 0.5, llmFit: 0.3, structural: 0.2 };

describe('levenshtein', () => {
  it('computes small distances', () => {
    expect(levenshtein('pytorch', 'pytorch')).toBe(0);
    expect(levenshtein('pytorch', 'pytorh')).toBe(1);
    expect(levenshtein('ros2', 'ros 2'.replace(/ /g, ''))).toBe(0);
  });
  it('early-exits beyond max', () => {
    expect(levenshtein('completely', 'different', 2)).toBeGreaterThan(2);
  });
});

describe('termMatches (ATS fuzzy)', () => {
  it('matches exact and case-insensitive', () => {
    expect(termMatches('PyTorch', 'pytorch')).toBe(true);
  });
  it('matches within phrases', () => {
    expect(termMatches('experience with ROS 2', 'ROS 2')).toBe(true);
    expect(termMatches('C++', 'C/C++')).toBe(true);
  });
  it('matches small typos via levenshtein', () => {
    expect(termMatches('Kubernets', 'Kubernetes')).toBe(true);
  });
  it('rejects unrelated terms', () => {
    expect(termMatches('Java', 'Rust')).toBe(false);
    expect(termMatches('AWS', 'CSS')).toBe(false);
  });
});

describe('keywordScore', () => {
  const candidate = ['Rust', 'C/C++', 'Python', 'PyTorch', 'ROS 2'];
  it('weights must-haves 3x', () => {
    const parsed = { mustHaves: ['C++'], hardSkills: [], niceToHaves: ['Go'] };
    // matched 3 of 4 total weight
    expect(keywordScore(parsed, candidate).value).toBeCloseTo(0.75);
  });
  it('merges mustHaves and hardSkills without double counting', () => {
    const parsed = { mustHaves: ['Python'], hardSkills: ['Python'], niceToHaves: [] };
    expect(keywordScore(parsed, candidate).value).toBe(1);
  });
  it('reports missing terms', () => {
    const parsed = { mustHaves: ['Haskell'], hardSkills: [], niceToHaves: [] };
    const result = keywordScore(parsed, candidate);
    expect(result.value).toBe(0);
    expect(result.missing).toContain('Haskell');
  });
  it('returns the KEYWORD_SCORE_FLOOR (0.5) when JD has no extractable terms', () => {
    expect(
      keywordScore({ mustHaves: [], hardSkills: [], niceToHaves: [] }, candidate).value
    ).toBe(0.5);
  });
});

// The three F-1 seed constraints (§5.2 mapping) — exactly what migration plants.
const CONSTRAINTS: Constraint[] = [
  {
    id: 'citizenship',
    label: 'must accept F-1 (no citizenship/clearance)',
    field: 'citizenshipOrClearanceRequired',
    test: { kind: 'isTrue' },
    effect: { kind: 'hard' },
    enabled: true,
  },
  {
    id: 'seniority',
    label: 'internship-level only',
    field: 'seniority',
    test: { kind: 'notIn', values: ['intern', 'entry', 'unspecified'] },
    effect: { kind: 'penalty', amount: 0.6 },
    enabled: true,
  },
  {
    id: 'sponsorship',
    label: 'sponsorship not explicitly unavailable',
    field: 'sponsorshipAvailable',
    test: { kind: 'equals', value: 'no' },
    effect: { kind: 'penalty', amount: 0.4 },
    enabled: true,
  },
];

const base: JdSchema = {
  hardSkills: [],
  softSkills: [],
  mustHaves: [],
  niceToHaves: [],
  responsibilities: [],
  seniority: 'intern',
  citizenshipOrClearanceRequired: false,
  sponsorshipAvailable: 'unstated',
  internshipTerm: null,
  minEducation: null,
};

describe('evaluateConstraints (two-list, hard + penalty)', () => {
  it('full score for F-1 compatible internships', () => {
    const r = evaluateConstraints(base, CONSTRAINTS);
    expect(r.value).toBe(1);
    expect(r.constraintsFired).toEqual([]);
  });
  it('zeroes on citizenship/clearance (hard)', () => {
    const r = evaluateConstraints(
      { ...base, citizenshipOrClearanceRequired: true },
      CONSTRAINTS
    );
    expect(r.value).toBe(0);
    expect(r.constraintsFired).toContainEqual({ id: 'citizenship', effect: 'hard' });
  });
  it('penalizes senior roles (-0.6) and no-sponsorship (-0.4)', () => {
    expect(evaluateConstraints({ ...base, seniority: 'senior' }, CONSTRAINTS).value).toBeCloseTo(
      0.4
    );
    expect(
      evaluateConstraints({ ...base, sponsorshipAvailable: 'no' }, CONSTRAINTS).value
    ).toBeCloseTo(0.6);
  });
  it('clamps complementary penalties at >=0', () => {
    const r = evaluateConstraints(
      { ...base, seniority: 'senior', sponsorshipAvailable: 'no' },
      CONSTRAINTS
    );
    expect(r.value).toBe(0); // 1 - 0.6 - 0.4 = 0, never negative
    expect(r.constraintsFired.map((c) => c.id)).toEqual(['seniority', 'sponsorship']);
  });
  it('records constraint attribution with penalty amounts', () => {
    const r = evaluateConstraints({ ...base, seniority: 'senior' }, CONSTRAINTS);
    expect(r.constraintsFired).toEqual([
      { id: 'seniority', effect: 'penalty', amount: 0.6 },
    ]);
  });
  it('skips disabled constraints', () => {
    const disabled = CONSTRAINTS.map((c) =>
      c.id === 'citizenship' ? { ...c, enabled: false } : c
    );
    const r = evaluateConstraints(
      { ...base, citizenshipOrClearanceRequired: true },
      disabled
    );
    expect(r.value).toBe(1); // hard rule disabled
    expect(r.constraintsFired).toEqual([]);
  });
  it('empty constraints list yields a neutral structural 1', () => {
    expect(evaluateConstraints(base, []).value).toBe(1);
  });
});

describe('combine', () => {
  it('applies the configured weights', () => {
    expect(combine(1, 1, 1, WEIGHTS)).toBe(1);
    expect(combine(0.8, 0.7, 1, WEIGHTS)).toBeCloseTo(0.81);
    expect(combine(0, 0, 0, WEIGHTS)).toBe(0);
  });
});
