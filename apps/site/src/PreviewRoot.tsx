import React, { useEffect, useState } from 'react';
import {
  PREVIEW_MESSAGE_SOURCE,
  type PreviewMessage,
} from '@resume/contracts';
import { resumePayload, applicationPayload, type RenderPayload } from '@data';
import App from './App';
import PaperFrame from './PaperFrame';
import { reduceMessage, type PreviewDeps, type PreviewState } from './preview';

// The bare-host root. On a normal visit (no ?preview) it renders EXACTLY
// `<App payload={initial} />` and mounts NO listener / paper frame — preserving
// the byte-identical default render DOM. All live-preview behavior is gated on a
// truthy `preview` param:
//   ?preview=1     → live fluid render (no paper frame), swaps on postMessage
//   ?preview=paper → live render inside the paper-accurate frame (main preview)
// The layout sub-mode (multipage default / continuous) is driven at runtime by
// {type:'mode'} messages, not the query.

// The real @data builders the reducer needs (kept out of preview.ts so that
// module stays alias-free / node-testable).
const deps: PreviewDeps = { resumePayload, applicationPayload };

export default function PreviewRoot({
  initial,
  preview,
}: {
  initial: RenderPayload;
  preview: string | null;
}) {
  const [state, setState] = useState<PreviewState>({
    payload: initial,
    layout: 'multipage',
  });

  // INVARIANT: with no `preview` param, return exactly <App payload={initial}/> —
  // no effect, no listener, no frame. Hooks above run unconditionally (state is
  // inert) so hook order stays stable; the listener effect below is gated.
  useEffect(() => {
    if (!preview) return;
    const origin = window.location.origin;

    // child → parent: mounted and listening, send me the current payload.
    if (window.parent && window.parent !== window) {
      const ready: PreviewMessage = {
        source: PREVIEW_MESSAGE_SOURCE,
        type: 'ready',
      };
      window.parent.postMessage(ready, origin);
    }

    const onMessage = (event: MessageEvent) => {
      // same-origin + source-tagged only (screens out devtools / HMR / extensions)
      if (event.origin !== origin) return;
      if (
        typeof event.data !== 'object' ||
        event.data === null ||
        (event.data as { source?: unknown }).source !== PREVIEW_MESSAGE_SOURCE
      ) {
        return;
      }
      // `initial.doc` is the saved base résumé an overlay applies onto.
      setState((s) => reduceMessage(s, initial.doc, event.data, deps));
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [preview, initial.doc]);

  if (!preview) {
    return <App payload={initial} />;
  }

  if (preview === 'paper') {
    return (
      <PaperFrame doc={state.payload.doc} layout={state.layout}>
        <App payload={state.payload} />
      </PaperFrame>
    );
  }

  // ?preview=1 — live fluid render, no paper frame.
  return <App payload={state.payload} />;
}
