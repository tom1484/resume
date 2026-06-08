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
}: {
  applicationId?: string;
  reloadKey?: number;
  className?: string;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const base = applicationId
    ? `/resume/?application=${encodeURIComponent(applicationId)}`
    : '/resume/';
  // cache-bust so a save is reflected immediately
  const sep = base.includes('?') ? '&' : '?';
  const src = `${base}${sep}rev=${reloadKey}`;

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
    <div className={className}>
      <div className="print-hide mb-2 flex items-center gap-2">
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
        ref={ref}
        title={applicationId ? `tailored résumé ${applicationId}` : 'résumé'}
        src={src}
        className="print-canvas h-[1100px] w-full rounded-md border bg-white"
      />
    </div>
  );
}
