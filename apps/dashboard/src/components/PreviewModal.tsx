import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PREVIEW_MESSAGE_SOURCE,
  type PreviewLayout,
  type PreviewMessage,
  type ResumeDoc,
  type Overlay,
} from '@resume/contracts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { ResumeCanvas } from '@/components/ResumeCanvas';

// Blocking centered preview modal. Hosts the iframe canvas (bare résumé host)
// and pushes the CURRENT, possibly UNSAVED, doc/overlay into the frame over the
// typed postMessage channel (@resume/contracts). The editor is not interactable
// while this is open — the point is to render exactly what's in memory now.
//
// Handshake: the bare host posts {type:'ready'} on mount; we reply with the
// current payload ({type:'resume'|'overlay'}) + the current layout ({type:'mode'}).
// We also re-post (debounced) whenever doc/overlay/layout change while open, to
// cover the case where the iframe was already ready before an edit landed.
export function PreviewModal({
  open,
  onOpenChange,
  applicationId,
  doc,
  overlay,
  reloadKey,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  applicationId?: string;
  doc?: ResumeDoc;
  overlay?: Overlay;
  reloadKey?: number;
}) {
  const [layout, setLayout] = useState<PreviewLayout>('multipage');

  // Hold the latest values in refs so the message listener (registered once per
  // open) always posts the current payload without re-subscribing on every edit.
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const docRef = useRef(doc);
  const overlayRef = useRef(overlay);
  const layoutRef = useRef(layout);
  docRef.current = doc;
  overlayRef.current = overlay;
  layoutRef.current = layout;

  // Post the current in-memory payload + layout to the iframe.
  const postCurrent = useCallback(() => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    const target = window.location.origin;
    const o = overlayRef.current;
    const d = docRef.current;
    if (o) {
      const msg: PreviewMessage = {
        source: PREVIEW_MESSAGE_SOURCE,
        type: 'overlay',
        overlay: o,
      };
      win.postMessage(msg, target);
    } else if (d) {
      const msg: PreviewMessage = {
        source: PREVIEW_MESSAGE_SOURCE,
        type: 'resume',
        doc: d,
      };
      win.postMessage(msg, target);
    }
    const modeMsg: PreviewMessage = {
      source: PREVIEW_MESSAGE_SOURCE,
      type: 'mode',
      layout: layoutRef.current,
    };
    win.postMessage(modeMsg, target);
  }, []);

  // While open: reply to the bare host's `ready` handshake. Ignore anything
  // that isn't a same-origin, source-tagged `ready` (devtools/HMR/extensions).
  useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as PreviewMessage | undefined;
      if (data?.source !== PREVIEW_MESSAGE_SOURCE) return;
      if (data.type !== 'ready') return;
      postCurrent();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, postCurrent]);

  // While open: re-post (debounced) whenever the payload or layout changes, in
  // case the iframe was already ready before this edit/toggle landed.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(postCurrent, 150);
    return () => window.clearTimeout(id);
  }, [open, doc, overlay, layout, postCurrent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-[min(95vw,1100px)] flex-col p-0">
        <DialogHeader className="flex flex-row items-center justify-between gap-4 border-b p-4 pr-12 text-left">
          <DialogTitle>Preview</DialogTitle>
          <label className="flex items-center gap-2 text-sm font-normal">
            <span className="text-muted-foreground">Continuous</span>
            <Switch
              aria-label="Continuous layout"
              checked={layout === 'continuous'}
              onCheckedChange={(checked) =>
                setLayout(checked ? 'continuous' : 'multipage')
              }
            />
          </label>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          {open && (
            <ResumeCanvas
              live
              paper
              applicationId={applicationId}
              reloadKey={reloadKey}
              onFrameRef={(el) => {
                frameRef.current = el;
              }}
              className="min-h-0 flex-1"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
