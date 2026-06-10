// Pure, node-testable reducer for the live preview channel.
//
// The bare host (PreviewRoot) holds a PreviewState and folds incoming
// postMessage payloads into it via `reduceMessage`. This module is kept FREE of
// any DOM/window reference so it runs in the plain `node` vitest project (which
// has no Vite aliases). For the same reason it does NOT import `@data` at module
// scope — instead the payload builders are injected by the caller (PreviewRoot
// passes the real `@data` functions; the test passes them via a relative import
// of the renderer source). `preview.test.ts` exercises the real builders.
import {
  PREVIEW_MESSAGE_SOURCE,
  type PreviewLayout,
  type ResumeDoc,
  type Overlay,
} from '@resume/contracts';
import type { RenderPayload } from '@data';

export interface PreviewState {
  payload: RenderPayload;
  layout: PreviewLayout;
}

// The two payload builders the reducer needs. Injected so this module stays
// alias-free / node-testable; their real implementations live in `@data`
// (`resumePayload`, `applicationPayload`) and are wired in by PreviewRoot.
export interface PreviewDeps {
  resumePayload: (doc: ResumeDoc) => RenderPayload;
  applicationPayload: (overlay: Overlay, base: ResumeDoc) => RenderPayload;
}

function isPreviewMessage(msg: unknown): msg is Record<string, unknown> {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { source?: unknown }).source === PREVIEW_MESSAGE_SOURCE
  );
}

/**
 * Fold one incoming message into the preview state.
 *
 * - Anything that is not an object tagged with `source === PREVIEW_MESSAGE_SOURCE`
 *   is ignored (state returned unchanged) — screens out foreign postMessage
 *   traffic (devtools, extensions, Vite HMR).
 * - `type:'resume'`  → rebuild payload from `deps.resumePayload(msg.doc)`.
 * - `type:'overlay'` → rebuild payload from `deps.applicationPayload(msg.overlay, base)`.
 *   `base` is the saved base résumé the overlay applies onto.
 * - `type:'mode'`    → swap the layout engine.
 * - `type:'ready'` or unknown type → unchanged.
 */
export function reduceMessage(
  state: PreviewState,
  base: ResumeDoc,
  msg: unknown,
  deps: PreviewDeps
): PreviewState {
  if (!isPreviewMessage(msg)) return state;
  switch (msg.type) {
    case 'resume':
      return { ...state, payload: deps.resumePayload(msg.doc as ResumeDoc) };
    case 'overlay':
      return {
        ...state,
        payload: deps.applicationPayload(msg.overlay as Overlay, base),
      };
    case 'mode':
      return { ...state, layout: msg.layout as PreviewLayout };
    // 'ready' (child→parent only) and anything unknown: no state change.
    default:
      return state;
  }
}
