import { describe, it, expect } from 'vitest';
import { timeZones, JOBSPY_COUNTRIES } from './lists';

describe('timeZones', () => {
  it('returns a non-trivial list including common zones', () => {
    const tz = timeZones();
    expect(tz.length).toBeGreaterThan(50);
    expect(tz).toContain('Asia/Taipei');
    expect(tz).toContain('UTC');
  });
  it('is memoized (same reference across calls)', () => {
    expect(timeZones()).toBe(timeZones());
  });
});

describe('JOBSPY_COUNTRIES', () => {
  it('includes the default USA', () => {
    expect(JOBSPY_COUNTRIES).toContain('USA');
  });
});
