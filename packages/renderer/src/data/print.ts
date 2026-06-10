// Print configuration (meta.print on the canonical résumé; applications inherit
// it since overlays apply onto the résumé). Two consumers:
//   - the renderer injects pageCss() as an @page rule (browser print / Save-as-PDF)
//   - the PDF pipeline feeds pdfOptions() to Playwright's page.pdf()
// Defaults reproduce the prior behavior (A4, no margins, scale 1) so nothing
// changes until the user edits it. PAPER_SIZES comes from §2.3 PrintConfig (the
// one list); getPrint/pageCss/pdfOptions port KEEP verbatim from v1.
import { PAPER_SIZES, PAPER_DIMENSIONS } from '@resume/contracts';

export { PAPER_SIZES, PAPER_DIMENSIONS };

// CSS px per millimetre at the browser's default print resolution (96 dpi, so
// 1in = 96px and 1in = 25.4mm). The on-screen paper-accurate preview uses this
// to size the page wrapper / margins from PAPER_DIMENSIONS (mm). Kept beside
// pageCss/pdfOptions as a pure function (the data layer), not in contracts.
export const MM_TO_PX = 96 / 25.4;

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}

export interface PrintSettings {
  paperSize: string;
  margins: { top: number; right: number; bottom: number; left: number };
  scale: number;
}

export const PRINT_DEFAULTS: PrintSettings = {
  paperSize: 'A4',
  margins: { top: 0, right: 0, bottom: 0, left: 0 }, // mm
  scale: 1,
};

export function getPrint(doc: unknown): PrintSettings {
  const p =
    ((doc as { meta?: { print?: Record<string, unknown> } })?.meta?.print ??
      {}) as {
      paperSize?: string;
      margins?: Record<string, unknown>;
      scale?: number;
    };
  const m = (p.margins ?? {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) =>
    typeof v === 'number' && v >= 0 ? v : d;
  return {
    paperSize: (PAPER_SIZES as readonly string[]).includes(p.paperSize ?? '')
      ? (p.paperSize as string)
      : PRINT_DEFAULTS.paperSize,
    margins: {
      top: num(m.top, 0),
      right: num(m.right, 0),
      bottom: num(m.bottom, 0),
      left: num(m.left, 0),
    },
    scale: typeof p.scale === 'number' && p.scale > 0 ? p.scale : 1,
  };
}

// @page rule for browser print (size + margins; scale is applied by the PDF
// pipeline / the browser's own print dialog).
export function pageCss(print: PrintSettings): string {
  const m = print.margins;
  return `@page { size: ${print.paperSize}; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }`;
}

// Options object for Playwright page.pdf().
export function pdfOptions(print: PrintSettings): {
  format: string;
  printBackground: boolean;
  displayHeaderFooter: boolean;
  margin: { top: string; right: string; bottom: string; left: string };
  scale: number;
} {
  const m = print.margins;
  return {
    format: print.paperSize,
    printBackground: true,
    displayHeaderFooter: false,
    margin: {
      top: `${m.top}mm`,
      right: `${m.right}mm`,
      bottom: `${m.bottom}mm`,
      left: `${m.left}mm`,
    },
    scale: print.scale,
  };
}
