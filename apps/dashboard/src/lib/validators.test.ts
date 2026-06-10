import { describe, it, expect } from 'vitest';
import { validateCron, isValidTimeZone, weightsSumWarning } from './validators';

describe('validateCron — mirrors discovery/cron.py grammar', () => {
  it('accepts valid 5-field expressions', () => {
    expect(validateCron('0 9 * * *')).toBeUndefined();
    expect(validateCron('*/15 * * * *')).toBeUndefined();
    expect(validateCron('0 9 * * 1-5')).toBeUndefined();
    expect(validateCron('0,30 8-17 * * *')).toBeUndefined();
    expect(validateCron('0 0 1 1 0')).toBeUndefined();
    expect(validateCron('0 9 * * 7')).toBeUndefined(); // 7 = Sunday
  });

  it('rejects the wrong field count', () => {
    expect(validateCron('* * * *')).toMatch(/5 fields/);
    expect(validateCron('* * * * * *')).toMatch(/5 fields/);
    expect(validateCron('')).toBeTruthy();
  });

  it('rejects out-of-range values per field', () => {
    expect(validateCron('60 * * * *')).toMatch(/minute/); // minute max 59
    expect(validateCron('* 24 * * *')).toMatch(/hour/); // hour max 23
    expect(validateCron('* * 0 * *')).toMatch(/day-of-month/); // dom min 1
    expect(validateCron('* * * 13 *')).toMatch(/month/); // month max 12
    expect(validateCron('* * * * 8')).toMatch(/day-of-week/); // dow max 7
  });

  it('rejects malformed terms and steps', () => {
    expect(validateCron('a * * * *')).toBeTruthy();
    expect(validateCron('*/0 * * * *')).toMatch(/step/);
    expect(validateCron('5-1 * * * *')).toMatch(/start > end/);
  });
});

describe('isValidTimeZone', () => {
  it('accepts known IANA zones', () => {
    expect(isValidTimeZone('Asia/Taipei')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
  });
  it('rejects garbage', () => {
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('weightsSumWarning', () => {
  it('is quiet when weights sum to ~1', () => {
    expect(weightsSumWarning({ keyword: 0.5, llmFit: 0.3, structural: 0.2 })).toBeUndefined();
  });
  it('warns when they do not', () => {
    expect(weightsSumWarning({ keyword: 0.5, llmFit: 0.5, structural: 0.5 })).toMatch(/1\.00/);
  });
});
