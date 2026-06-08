import { describe, expect, it } from 'vitest';
import { batchSummary } from './notify.js';

describe('batchSummary', () => {
  it('formats counts, flags, review links, edits, and escapes HTML', () => {
    const text = batchSummary({
      scored: 3,
      threshold: 0.65,
      reviewBase: 'https://jobs.churong.cc',
      tailored: [
        {
          id: 'gh-figure-1', score: 0.81, company: 'Figure', company_flags: ['dream', 'startup'],
          title: 'Embedded <SW> Intern', patches: 2,
        },
      ],
    });
    expect(text).toContain('3 jobs scored, 1 tailored');
    expect(text).toContain('<b>0.81</b>');
    expect(text).toContain('[dream,startup]');
    expect(text).toContain('https://jobs.churong.cc/#/app/gh-figure-1');
    expect(text).toContain('2 edits');
    expect(text).toContain('Embedded &lt;SW&gt; Intern'); // HTML-escaped
  });

  it('handles a cycle with nothing tailored', () => {
    const text = batchSummary({ scored: 8, threshold: 0.65, tailored: [] });
    expect(text).toBe('🧭 8 jobs scored, 0 tailored & ready to review (≥ 0.65)');
  });
});
