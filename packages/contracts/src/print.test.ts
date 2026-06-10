import { describe, it, expect } from 'vitest';
import { PAPER_SIZES, PAPER_DIMENSIONS } from './print.js';

describe('PAPER_DIMENSIONS (§2.3) — physical mm per paper size', () => {
  it('has a positive-dimension entry for every PAPER_SIZES key (no drift)', () => {
    for (const size of PAPER_SIZES) {
      const dims = PAPER_DIMENSIONS[size];
      expect(dims, `missing dims for ${size}`).toBeDefined();
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(dims.width); // portrait
    }
  });
  it('uses the standard A4 millimetre size', () => {
    expect(PAPER_DIMENSIONS.A4).toEqual({ width: 210, height: 297 });
  });
});
