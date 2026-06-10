// Preview postMessage protocol — the typed channel between the dashboard
// (parent) and the bare résumé host (iframe child) used to render UNSAVED edits
// in the preview modal. Not a DB/data contract, but it carries ResumeDoc/Overlay
// (which ARE contracts), so co-locating the message type here keeps both sides
// aligned via @resume/contracts — the dashboard sender and the bare-host
// receiver import the same type, never restate it.
//
// Transport rules (enforced by both ends, not by this type):
//   - same-origin only: ignore messages whose event.origin !== location.origin
//   - source-tagged: ignore messages whose `source` !== PREVIEW_MESSAGE_SOURCE
//     (screens out devtools / extensions / Vite HMR chatter)
//   - targetOrigin = location.origin in both directions
//
// Flow: child posts {type:'ready'} on mount → parent replies with the current
// payload ({type:'resume'|'overlay'}) + current layout ({type:'mode'}); parent
// re-posts on edit while the modal is open.
import type { ResumeDoc } from './resume.js';
import type { Overlay } from './overlay.js';

export const PREVIEW_MESSAGE_SOURCE = 'resume-preview' as const;

/** Paper-frame layout engine for the preview. */
export type PreviewLayout = 'multipage' | 'continuous';

export type PreviewMessage =
  // child → parent: iframe mounted and listening; send me the current payload.
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: 'ready' }
  // parent → child: render this (unsaved) canonical résumé.
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: 'resume'; doc: ResumeDoc }
  // parent → child: render this (unsaved) tailoring overlay over the base résumé.
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: 'overlay'; overlay: Overlay }
  // parent → child: switch the paper-frame layout engine (no reload).
  | { source: typeof PREVIEW_MESSAGE_SOURCE; type: 'mode'; layout: PreviewLayout };
