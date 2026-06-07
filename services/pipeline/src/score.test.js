// Deterministic scoring math (no LLM, no DB).
import { describe, expect, it } from 'vitest';
import { combine, keywordScore, levenshtein, structuralScore, termMatches, WEIGHTS } from './score.js';

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
  it('returns neutral 0.5 when JD has no extractable terms', () => {
    expect(keywordScore({ mustHaves: [], hardSkills: [], niceToHaves: [] }, candidate).value).toBe(0.5);
  });
});

describe('structuralScore', () => {
  const base = {
    seniority: 'intern',
    citizenshipOrClearanceRequired: false,
    sponsorshipAvailable: 'unstated',
  };
  it('full score for F-1 compatible internships', () => {
    expect(structuralScore(base).value).toBe(1);
  });
  it('zeroes on citizenship/clearance', () => {
    expect(structuralScore({ ...base, citizenshipOrClearanceRequired: true }).value).toBe(0);
  });
  it('penalizes senior roles and no-sponsorship', () => {
    expect(structuralScore({ ...base, seniority: 'senior' }).value).toBeCloseTo(0.4);
    expect(structuralScore({ ...base, sponsorshipAvailable: 'no' }).value).toBeCloseTo(0.6);
  });
});

describe('combine', () => {
  it('applies the documented weights', () => {
    expect(WEIGHTS).toEqual({ keyword: 0.5, llmFit: 0.3, structural: 0.2 });
    expect(combine(1, 1, 1)).toBe(1);
    expect(combine(0.8, 0.7, 1)).toBeCloseTo(0.81);
    expect(combine(0, 0, 0)).toBe(0);
  });
});
