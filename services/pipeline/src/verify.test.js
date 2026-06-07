// Deterministic verification layers (no LLM): the numeric tripwire is the
// hard guarantee that invented metrics can NEVER pass the audit.
import { describe, expect, it } from 'vitest';
import { extractNumbers, numericTripwire } from './verify.js';
import { master } from './profile.js';

// pick a real bullet that contains a number, dynamically (id-stable bank)
const numericBullet = master.bullets.find((b) => /\d/.test(b.text));

describe('extractNumbers', () => {
  it('extracts metrics', () => {
    expect(extractNumbers('reduced loss by 90% and 3.5x faster')).toEqual(['90', '3.5']);
  });
  it('handles no numbers', () => {
    expect(extractNumbers('improved performance significantly')).toEqual([]);
  });
});

describe('numericTripwire', () => {
  it('passes when patch numbers exist in cited bullets', () => {
    const num = extractNumbers(numericBullet.text)[0];
    expect(numericTripwire(`achieved ${num} improvement`, [numericBullet.id])).toEqual([]);
  });
  it('trips on numbers absent from cited bullets', () => {
    expect(numericTripwire('led a team of 17 engineers', [numericBullet.id])).toContain('17');
  });
  it('ignores plausible year mentions', () => {
    expect(numericTripwire('during Summer 2027 internship', [numericBullet.id])).toEqual([]);
  });
  it('trips on everything when nothing is cited', () => {
    expect(numericTripwire('cut latency by 73%', [])).toContain('73');
  });
});
