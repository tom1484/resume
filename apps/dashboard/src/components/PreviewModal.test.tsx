import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { PreviewModal } from './PreviewModal';
import { PREVIEW_MESSAGE_SOURCE, type ResumeDoc } from '@resume/contracts';

// Minimal résumé-shaped object — the modal forwards it verbatim over
// postMessage, it never inspects the shape, so a cast is enough for this test.
const fakeDoc = { name: 'Test Person', sections: [] } as unknown as ResumeDoc;

function dispatch(data: unknown, origin = window.location.origin) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin }));
  });
}

describe('PreviewModal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('replies to a same-origin `ready` handshake with the current doc + mode', async () => {
    render(<PreviewModal open onOpenChange={() => {}} doc={fakeDoc} />);

    // The canvas iframe renders inside the (portalled) dialog content.
    const iframe = (await screen.findByTitle('résumé')) as HTMLIFrameElement;
    const win = iframe.contentWindow!;
    const post = vi.spyOn(win, 'postMessage').mockImplementation(() => {});

    // The bare host announces it's listening.
    dispatch({ source: PREVIEW_MESSAGE_SOURCE, type: 'ready' });

    await waitFor(() => expect(post).toHaveBeenCalled());

    // It posted the current (unsaved) doc…
    expect(post).toHaveBeenCalledWith(
      { source: PREVIEW_MESSAGE_SOURCE, type: 'resume', doc: fakeDoc },
      window.location.origin
    );
    // …and the current layout (defaults to multipage).
    expect(post).toHaveBeenCalledWith(
      { source: PREVIEW_MESSAGE_SOURCE, type: 'mode', layout: 'multipage' },
      window.location.origin
    );
  });

  it('ignores foreign-origin and foreign-source messages', async () => {
    render(<PreviewModal open onOpenChange={() => {}} doc={fakeDoc} />);

    const iframe = (await screen.findByTitle('résumé')) as HTMLIFrameElement;
    const win = iframe.contentWindow!;

    // Let the initial debounced re-post fire (and clear it) before asserting,
    // so the spy below only captures handshake-triggered posts.
    await new Promise((r) => setTimeout(r, 200));
    const post = vi.spyOn(win, 'postMessage').mockImplementation(() => {});

    // Wrong origin: must be ignored.
    dispatch(
      { source: PREVIEW_MESSAGE_SOURCE, type: 'ready' },
      'https://evil.example.com'
    );
    // Wrong source: must be ignored.
    dispatch({ source: 'something-else', type: 'ready' });

    // Give any (incorrect) async post a chance to fire.
    await new Promise((r) => setTimeout(r, 50));
    expect(post).not.toHaveBeenCalled();
  });
});
