// Deterministic verification layers (no LLM, no DB): the numeric tripwire is the
// hard guarantee that invented metrics can NEVER pass the audit (§11). The
// extraction + year-window logic lives in @resume/contracts (the ONE source);
// numericTripwire wires it to the file-based master bank.
import { describe, expect, it } from 'vitest';
import { extractTripwireNumbers, isStructurallyGrounded } from '@resume/contracts';
import { numericTripwire } from './verify.js';
import { master } from './profile.js';

// pick a real bullet that contains a number, dynamically (id-stable bank)
const numericBullet = master.bullets.find((b) => /\d/.test(b.text))!;

describe('extractTripwireNumbers (contract)', () => {
  it('extracts metrics', () => {
    expect(extractTripwireNumbers('reduced loss by 90% and 3.5x faster')).toEqual([90, 3.5]);
  });
  it('handles no numbers', () => {
    expect(extractTripwireNumbers('improved performance significantly')).toEqual([]);
  });
  it('excludes plausible years (2019-2030)', () => {
    expect(extractTripwireNumbers('during Summer 2027 internship')).toEqual([]);
  });
});

describe('numericTripwire', () => {
  it('passes when patch numbers exist in cited bullets', () => {
    const num = extractTripwireNumbers(numericBullet.text)[0];
    expect(numericTripwire(`achieved ${num} improvement`, [numericBullet.id])).toEqual([]);
  });
  it('trips on numbers absent from cited bullets', () => {
    expect(numericTripwire('led a team of 17 engineers', [numericBullet.id])).toContain(17);
  });
  it('ignores plausible year mentions', () => {
    expect(numericTripwire('during Summer 2027 internship', [numericBullet.id])).toEqual([]);
  });
  it('trips on everything when nothing is cited', () => {
    expect(numericTripwire('cut latency by 73%', [])).toContain(73);
  });
});

describe('isStructurallyGrounded (contract auto-fail layer)', () => {
  const known = new Set(master.bullets.map((b) => b.id));
  it('fails empty grounding', () => {
    expect(isStructurallyGrounded([], known)).toBe(false);
  });
  it('fails unknown ids', () => {
    expect(isStructurallyGrounded(['not-a-real-bullet'], known)).toBe(false);
  });
  it('passes a real bullet id', () => {
    expect(isStructurallyGrounded([numericBullet.id], known)).toBe(true);
  });
});
