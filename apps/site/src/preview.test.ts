import { describe, it, expect } from 'vitest';
import { PREVIEW_MESSAGE_SOURCE } from '@resume/contracts';
import type { ResumeDoc } from '@resume/contracts';
// Relative import of the renderer source: the plain `node` vitest project has no
// `@data` Vite alias, so we reach the real builders by path. These are the SAME
// `resumePayload`/`applicationPayload` PreviewRoot injects in the browser build.
import {
  resumePayload,
  applicationPayload,
  bundledSeed,
  type RenderPayload,
} from '../../../packages/renderer/src/data/index';
import { reduceMessage, type PreviewDeps, type PreviewState } from './preview';

const deps: PreviewDeps = { resumePayload, applicationPayload };

// A distinct base doc so we can assert overlay application keeps `.doc === base`.
const base: ResumeDoc = {
  ...(bundledSeed as ResumeDoc),
  meta: { ...(bundledSeed as ResumeDoc).meta, _marker: 'base-doc' },
} as ResumeDoc;

const initial: RenderPayload = resumePayload(base);
const start: PreviewState = { payload: initial, layout: 'multipage' };

// A minimal overlay good enough for applyOverlay: a jobId + a profile with an
// (empty) section list and no patches → applies cleanly against any base.
const overlay = {
  jobId: 'job-123',
  profile: { sections: [] as string[] },
  patches: [],
};

describe('reduceMessage (pure preview reducer)', () => {
  it('resume message → payload from resumePayload(doc)', () => {
    const edited: ResumeDoc = {
      ...base,
      meta: { ...base.meta, _marker: 'edited-doc' },
    } as ResumeDoc;
    const next = reduceMessage(
      start,
      base,
      { source: PREVIEW_MESSAGE_SOURCE, type: 'resume', doc: edited },
      deps
    );
    expect(next.payload.doc).toBe(edited);
    expect(next.payload).toEqual(resumePayload(edited));
    expect(next.layout).toBe('multipage'); // layout untouched
  });

  it('overlay message → applicationPayload(overlay, base) (doc IS base)', () => {
    const next = reduceMessage(
      start,
      base,
      { source: PREVIEW_MESSAGE_SOURCE, type: 'overlay', overlay },
      deps
    );
    // applicationPayload sets payload.doc to the base résumé (overlay re-apply).
    expect(next.payload.doc).toBe(base);
    expect(next.payload).toEqual(applicationPayload(overlay, base));
  });

  it('mode message → layout changes', () => {
    const next = reduceMessage(
      start,
      base,
      { source: PREVIEW_MESSAGE_SOURCE, type: 'mode', layout: 'continuous' },
      deps
    );
    expect(next.layout).toBe('continuous');
    expect(next.payload).toBe(initial); // payload untouched
  });

  it('foreign source is ignored (state unchanged)', () => {
    const next = reduceMessage(
      start,
      base,
      { source: 'some-other-tool', type: 'resume', doc: base },
      deps
    );
    expect(next).toBe(start);
  });

  it('ready message is ignored (state unchanged)', () => {
    const next = reduceMessage(
      start,
      base,
      { source: PREVIEW_MESSAGE_SOURCE, type: 'ready' },
      deps
    );
    expect(next).toBe(start);
  });

  it('unknown type / non-object is ignored (state unchanged)', () => {
    expect(
      reduceMessage(
        start,
        base,
        { source: PREVIEW_MESSAGE_SOURCE, type: 'bogus' },
        deps
      )
    ).toBe(start);
    expect(reduceMessage(start, base, null, deps)).toBe(start);
    expect(reduceMessage(start, base, 'resume', deps)).toBe(start);
    expect(reduceMessage(start, base, undefined, deps)).toBe(start);
  });
});
