import { describe, expect, it } from 'vitest';
import { batchSummary } from './notify.js';

describe('batchSummary', () => {
  it('formats counts, flags, and escapes HTML', () => {
    const text = batchSummary({
      scored: 3,
      threshold: 0.65,
      top: [
        {
          score: 0.81, company: 'Figure', company_flags: ['dream', 'startup'],
          title: 'Embedded <SW> Intern', url: 'https://x/1',
        },
      ],
    });
    expect(text).toContain('3 jobs scored, 1 ≥ 0.65');
    expect(text).toContain('<b>0.81</b>');
    expect(text).toContain('[dream,startup]');
    expect(text).toContain('Embedded &lt;SW&gt; Intern'); // HTML-escaped
  });

  it('handles an empty top list', () => {
    const text = batchSummary({ scored: 8, threshold: 0.65, top: [] });
    expect(text).toBe('🧭 8 jobs scored, 0 ≥ 0.65');
  });
});
