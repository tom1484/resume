import { describe, expect, it } from 'vitest';
import { getPrint, pageCss, pdfOptions, PRINT_DEFAULTS } from './print';

describe('getPrint', () => {
  it('defaults reproduce prior behavior when meta.print absent', () => {
    expect(getPrint({})).toEqual(PRINT_DEFAULTS);
    expect(getPrint({ meta: {} })).toEqual(PRINT_DEFAULTS);
  });
  it('reads a configured print block', () => {
    const p = getPrint({ meta: { print: { paperSize: 'Letter', margins: { top: 10, left: 12 }, scale: 0.9 } } });
    expect(p.paperSize).toBe('Letter');
    expect(p.margins).toEqual({ top: 10, right: 0, bottom: 0, left: 12 });
    expect(p.scale).toBe(0.9);
  });
  it('rejects an unknown paper size / bad scale', () => {
    const p = getPrint({ meta: { print: { paperSize: 'Foolscap', scale: -1 } } });
    expect(p.paperSize).toBe('A4');
    expect(p.scale).toBe(1);
  });
});

describe('pageCss / pdfOptions', () => {
  it('pageCss emits an @page rule with size + mm margins', () => {
    const css = pageCss(getPrint({ meta: { print: { paperSize: 'Letter', margins: { top: 10, right: 8, bottom: 10, left: 8 } } } }));
    expect(css).toBe('@page { size: Letter; margin: 10mm 8mm 10mm 8mm; }');
  });
  it('pdfOptions maps to Playwright page.pdf shape', () => {
    const o = pdfOptions(getPrint({ meta: { print: { paperSize: 'A3', scale: 1.1 } } }));
    expect(o.format).toBe('A3');
    expect(o.scale).toBe(1.1);
    expect(o.margin).toEqual({ top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' });
  });
});
