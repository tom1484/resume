import React, { useEffect, useRef, useState, type ReactNode } from 'react';
// getPrint/pageCss are re-exported from @data; PAPER_DIMENSIONS/mmToPx live in
// the print module (NOT re-exported by @data), so import those from @data/print.
import { getPrint, pageCss } from '@data';
import { PAPER_DIMENSIONS, mmToPx } from '@data/print';
import type { PreviewLayout, ResumeDoc } from '@resume/contracts';

// pagedjs ships no type declarations and resolves to an untyped JS module (so it
// can't be augmented). We only touch `new Previewer().preview(...)`, so type just
// that surface locally and cast the dynamic import to it. The dynamic import in
// MultiPageSheet keeps pagedjs out of the default bundle.
interface PagedPreviewer {
  preview(
    content: string | Node,
    stylesheets?: unknown[],
    renderTo?: Element
  ): Promise<unknown>;
}
interface PagedModule {
  Previewer: new () => PagedPreviewer;
}

// Paper-accurate preview wrapper (preview modes only — NEVER on the default
// render path; PreviewRoot only mounts this for ?preview=paper). Two engines:
//   - continuous (robust fallback): one tall white sheet at the configured paper
//     WIDTH + margins, content laid out at 1/scale of the content box then `zoom`ed
//     back by scale — replicating Playwright `scale` semantics.
//   - multipage (default): pagedjs paginates the SAME content into real
//     .pagedjs_page sheets honoring the renderer's break-inside rules, sized to
//     the @page rule. Pagedjs is dynamically imported so it never enters the
//     default bundle. If pagination fails it degrades to continuous (console.warn).
//
// `children` is the rendered résumé (<App payload/>) — used as the visible
// content for continuous, and as the hidden pagination SOURCE for multipage.
//
// All CSS here is scoped under `.paper-frame` so it cannot leak to the default
// render or to print. A defensive @media print revert keeps an in-iframe Print
// (the dashboard calls iframe.contentWindow.print()) clean.

const FRAME_CSS = `
.paper-frame {
  background: #e5e7eb;
  /* height (not min-height) + overflow:auto → the frame itself is the SINGLE
     scroll region for the page stack. With min-height the frame grew past the
     iframe and a second (document) scrollbar appeared. */
  height: 100vh;
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
  box-sizing: border-box;
}
.paper-frame__sheet {
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18), 0 6px 18px rgba(0, 0, 0, 0.12);
  box-sizing: border-box;
  overflow: hidden;
}
.paper-frame__pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}
.paper-frame__pages .pagedjs_page {
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18), 0 6px 18px rgba(0, 0, 0, 0.12);
  /* pagedjs nests pages in its own .pagedjs_pages wrapper, so the flex gap on
     .paper-frame__pages cannot reach them — give each page its own bottom
     gutter so the discrete sheets read as separate pages. */
  margin: 0 auto 24px;
}
/* off-screen source the paginator reads from */
.paper-frame__source {
  position: absolute;
  left: -100000px;
  top: 0;
  width: 0;
  height: 0;
  overflow: hidden;
}
/* Printing from the modal (iframe.contentWindow.print()): print ONLY the résumé,
   browser-paginated by the @page rule (size + margins) that useFrameStyle injects
   below with !important -- pagedjs injects its own @page margin:0 reset when it
   runs, and ours must out-rank it. The pagedjs page-boxes are fixed-size sheets
   that would print as extra/trailing BLANK pages, so hide them and reveal the
   off-screen source résumé in normal flow. Scale is zoom on the content (NOT a
   transform) so it survives into print and the browser paginates the scaled
   content; we deliberately do NOT revert it here. */
@media print {
  .paper-frame {
    background: none !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    display: block !important;
    padding: 0 !important;
  }
  .paper-frame__pages { display: none !important; }
  .paper-frame__source {
    position: static !important;
    left: auto !important;
    top: auto !important;
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
  }
  .paper-frame__sheet {
    box-shadow: none !important;
    width: auto !important;
    min-height: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }
}
`;

// Inject the frame CSS plus a print-only @page rule (size + margins) marked
// !important so it out-ranks pagedjs's own `@page { margin: 0 }` reset (which it
// appends to <head> when it paginates, after App's usePageStyle @page — equal
// specificity, so source order would otherwise let pagedjs win and drop margins
// from the printed output). Rebuilt on doc change so margin/size edits take hold.
function useFrameStyle(doc: ResumeDoc) {
  useEffect(() => {
    const print = getPrint(doc);
    const m = print.margins;
    const printPage = `@media print { @page { size: ${print.paperSize} !important; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm !important; } }`;
    const el = document.createElement('style');
    el.id = 'paper-frame-css';
    el.textContent = `${FRAME_CSS}\n${printPage}`;
    document.getElementById('paper-frame-css')?.remove();
    document.head.appendChild(el);
    return () => el.remove();
  }, [doc]);
}

interface Geometry {
  paperWidthPx: number;
  paperHeightPx: number;
  padT: number;
  padR: number;
  padB: number;
  padL: number;
  innerWidthPx: number;
  scale: number;
}

function geometry(doc: ResumeDoc): Geometry {
  const print = getPrint(doc);
  const dims =
    PAPER_DIMENSIONS[print.paperSize as keyof typeof PAPER_DIMENSIONS] ??
    PAPER_DIMENSIONS.A4;
  const paperWidthPx = mmToPx(dims.width);
  const paperHeightPx = mmToPx(dims.height);
  const padT = mmToPx(print.margins.top);
  const padR = mmToPx(print.margins.right);
  const padB = mmToPx(print.margins.bottom);
  const padL = mmToPx(print.margins.left);
  const contentBoxPx = paperWidthPx - padL - padR;
  const innerWidthPx = contentBoxPx / print.scale;
  return {
    paperWidthPx,
    paperHeightPx,
    padT,
    padR,
    padB,
    padL,
    innerWidthPx,
    scale: print.scale,
  };
}

// Continuous engine: always works, no async deps. Content box at the paper
// width minus margins; content laid out at innerWidth (= contentBox/scale) then
// `zoom`ed by `scale` so it reflows to fill the content box at the scaled size —
// matching Playwright page.pdf({scale}) semantics. zoom (not transform) so the
// scale also reflows + survives into print.
function ContinuousSheet({
  doc,
  children,
}: {
  doc: ResumeDoc;
  children: ReactNode;
}) {
  const g = geometry(doc);
  return (
    <div
      className="paper-frame__sheet"
      style={{
        width: g.paperWidthPx,
        minHeight: g.paperHeightPx,
        paddingTop: g.padT,
        paddingRight: g.padR,
        paddingBottom: g.padB,
        paddingLeft: g.padL,
      }}
    >
      <div
        className="paper-frame__inner"
        style={{
          width: g.innerWidthPx,
          zoom: g.scale,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Multipage engine via pagedjs. Renders `children` (the résumé) into a hidden
// source node wrapped in a `zoom`ed box (width = contentBox/scale, zoom = scale)
// so the SOURCE is already at the target scale + page width; pagedjs then reads
// that innerHTML and repaginates the scaled content into real pages honoring the
// @page rule. (zoom — not a stack transform — so scale changes page COUNT/density
// like Playwright's scale, instead of just visually shrinking the whole stack.)
// Falls back to continuous on any failure.
function MultiPageSheet({
  doc,
  children,
}: {
  doc: ResumeDoc;
  children: ReactNode;
}) {
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [degraded, setDegraded] = useState(false);
  const g = geometry(doc);

  useEffect(() => {
    let cancelled = false;
    // capture the target node for use in the async run AND the cleanup, so the
    // cleanup doesn't read a possibly-changed ref later.
    const target = targetRef.current;

    const run = async () => {
      const source = sourceRef.current;
      if (!source || !target) return;
      try {
        // Dynamic import → Vite splits pagedjs into its own chunk (kept out of
        // the default bundle, but still resolved/transformed by the build).
        // pagedjs ships no type declarations, hence the suppress + cast.
        // @ts-expect-error pagedjs has no type declarations
        const mod: PagedModule = await import('pagedjs');
        const { Previewer } = mod;
        if (cancelled) return;
        // clear any prior pagination output before re-running
        target.innerHTML = '';
        const print = getPrint(doc);
        const previewer = new Previewer();
        // inject the @page (size + margins) as an inline stylesheet
        await previewer.preview(
          source.innerHTML,
          [{ '/preview-page.css': pageCss(print) }],
          target
        );
        if (cancelled) target.innerHTML = '';
      } catch (err) {

        console.warn(
          '[PaperFrame] pagedjs pagination failed; degrading to continuous layout.',
          err
        );
        if (!cancelled) setDegraded(true);
      }
    };

    // debounce re-pagination on doc/scale change
    const timer = setTimeout(run, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (target) target.innerHTML = '';
    };
    // re-paginate when the rendered doc or scale change
  }, [doc, g.scale]);

  if (degraded) {
    return <ContinuousSheet doc={doc}>{children}</ContinuousSheet>;
  }

  return (
    <>
      {/* hidden source the paginator reads innerHTML from — pre-scaled via zoom so
          pagedjs paginates the scaled, full-page-width content */}
      <div className="paper-frame__source" ref={sourceRef} aria-hidden>
        <div style={{ width: g.innerWidthPx, zoom: g.scale }}>{children}</div>
      </div>
      {/* produced .pagedjs_page sheets, stacked at natural (paper) size */}
      <div className="paper-frame__pages" ref={targetRef} />
    </>
  );
}

export default function PaperFrame({
  doc,
  layout,
  children,
}: {
  doc: ResumeDoc;
  layout: PreviewLayout;
  children: ReactNode;
}) {
  useFrameStyle(doc);
  return (
    <div className="paper-frame">
      {layout === 'continuous' ? (
        <ContinuousSheet doc={doc}>{children}</ContinuousSheet>
      ) : (
        // remount the paginator on layout flip so it re-runs cleanly
        <MultiPageSheet key="multipage" doc={doc}>
          {children}
        </MultiPageSheet>
      )}
    </div>
  );
}
