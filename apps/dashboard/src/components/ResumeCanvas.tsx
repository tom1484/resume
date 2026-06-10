import { useEffect, useRef } from 'react';
import { Printer, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Live résumé canvas, rendered by IFRAMING THE BARE HOST (apps/site, served by
// the API at /resume/). Two modes:
//   - canonical résumé:  src="/resume/"                       (fetches /api/resume)
//   - tailored preview:  src="/resume/?application=<jobId>"   (fetches the overlay)
// Why an iframe and not in-app rendering: the renderer canvas is pixel-stable and
// is the Playwright PDF target (apps/site). Iframing the SAME bare host keeps the
// preview byte-identical to the PDF and isolates the renderer's Tailwind preflight
// from shadcn/ui's (DECISIONS req 3 + 4). The bare host's own usePageStyle/@page
// drives paper size/margins, so printing the frame yields ONLY the résumé.
export function ResumeCanvas({
  applicationId,
  reloadKey = 0,
  className = '',
  live = false,
  paper = false,
  onFrameRef,
}: {
  applicationId?: string;
  reloadKey?: number;
  className?: string;
  // live: enable the postMessage preview channel — appends `preview=…` to the
  // iframe query so the bare host runs its `ready` handshake and renders the
  // UNSAVED doc/overlay the parent posts in. paper: paper-accurate frame.
  live?: boolean;
  paper?: boolean;
  // Forwards the iframe element to the parent so it can postMessage to
  // iframe.contentWindow (the PreviewModal sender needs this).
  onFrameRef?: (el: HTMLIFrameElement | null) => void;
}) {
  const ref = useRef<HTMLIFrameElement | null>(null);
  const base = applicationId
    ? `/resume/?application=${encodeURIComponent(applicationId)}`
    : '/resume/';
  // cache-bust so a save is reflected immediately
  const sep = base.includes('?') ? '&' : '?';
  // When live, ask the bare host to listen on the preview channel. `paper`
  // requests the paper-accurate frame; otherwise a plain live frame.
  const previewParam = live ? (paper ? '&preview=paper' : '&preview=1') : '';
  const src = `${base}${sep}rev=${reloadKey}${previewParam}`;

  // Callback ref: keep the internal ref AND forward the element to the parent.
  const setFrame = (el: HTMLIFrameElement | null) => {
    ref.current = el;
    onFrameRef?.(el);
  };

  // Print isolation: when this canvas drives a browser print, hide the app
  // chrome and let only the canvas show. Toggled on the body so the @media print
  // rules in index.css apply (see .print-isolating / .print-canvas).
  useEffect(() => {
    const onBefore = () => document.body.classList.add('print-isolating');
    const onAfter = () => document.body.classList.remove('print-isolating');
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
      document.body.classList.remove('print-isolating');
    };
  }, []);

  const printFrame = () => {
    // Print ONLY the bare résumé: drive the iframe's own print context. The
    // frame renders the résumé alone (no chrome), so this is the cleanest output.
    ref.current?.contentWindow?.focus();
    ref.current?.contentWindow?.print();
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="print-hide mb-2 flex shrink-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={printFrame}>
          <Printer className="size-4" /> Print résumé
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={base} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> Open bare host
          </a>
        </Button>
      </div>
      <iframe
        ref={setFrame}
        title={applicationId ? `tailored résumé ${applicationId}` : 'résumé'}
        src={src}
        // Fill the remaining height (the bare host's own paper-frame is the single
        // scroll region) — NOT a fixed height, which would overflow the modal and
        // create a second scrollbar that also scrolls the button row away.
        className="print-canvas min-h-0 w-full flex-1 rounded-md border bg-white"
      />
    </div>
  );
}
