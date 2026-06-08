import { describe, expect, it } from 'vitest';
import { evaluateThresholds, parseCsv, type Sample } from './recommend-threshold.js';

describe('parseCsv', () => {
  it('handles quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('id,title,label\n1,"Engineer, ""Robotics"" Intern",good\n2,Plain,bad\n');
    expect(rows).toEqual([
      ['id', 'title', 'label'],
      ['1', 'Engineer, "Robotics" Intern', 'good'],
      ['2', 'Plain', 'bad'],
    ]);
  });
});

describe('evaluateThresholds', () => {
  it('finds the separating threshold on separable data', () => {
    const samples: Sample[] = [
      ...Array.from({ length: 10 }, (_, i) => ({ score: 0.7 + i * 0.01, label: 'good' })),
      ...Array.from({ length: 10 }, (_, i) => ({ score: 0.3 + i * 0.01, label: 'bad' })),
    ];
    const results = evaluateThresholds(samples);
    const best = results.reduce((a, b) => (b.f1 > a.f1 ? b : a));
    expect(best.f1).toBe(1);
    expect(best.threshold).toBeGreaterThan(0.39);
    expect(best.threshold).toBeLessThanOrEqual(0.7);
  });
});
