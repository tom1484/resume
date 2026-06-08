// Print configuration (meta.print on the canonical résumé; applications
// inherit it since overlays apply onto the résumé). Two consumers:
//   - the renderer injects pageCss() as an @page rule (browser print / Save-as-PDF)
//   - the PDF pipeline feeds pdfOptions() to Playwright's page.pdf()
// Defaults reproduce the prior behavior (A4, no margins, scale 1) so nothing
// changes until the user edits it.

export const PAPER_SIZES = ['A4', 'Letter', 'Legal', 'A3', 'A5'];

export const PRINT_DEFAULTS = {
  paperSize: 'A4',
  margins: { top: 0, right: 0, bottom: 0, left: 0 }, // mm
  scale: 1,
};

export function getPrint(doc) {
  const p = doc?.meta?.print ?? {};
  const m = p.margins ?? {};
  const num = (v, d) => (typeof v === 'number' && v >= 0 ? v : d);
  return {
    paperSize: PAPER_SIZES.includes(p.paperSize) ? p.paperSize : PRINT_DEFAULTS.paperSize,
    margins: {
      top: num(m.top, 0), right: num(m.right, 0), bottom: num(m.bottom, 0), left: num(m.left, 0),
    },
    scale: typeof p.scale === 'number' && p.scale > 0 ? p.scale : 1,
  };
}

// @page rule for browser print (size + margins; scale is applied by the PDF
// pipeline / the browser's own print dialog).
export function pageCss(print) {
  const m = print.margins;
  return `@page { size: ${print.paperSize}; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }`;
}

// Options object for Playwright page.pdf().
export function pdfOptions(print) {
  const m = print.margins;
  return {
    format: print.paperSize,
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: `${m.top}mm`, right: `${m.right}mm`, bottom: `${m.bottom}mm`, left: `${m.left}mm` },
    scale: print.scale,
  };
}
