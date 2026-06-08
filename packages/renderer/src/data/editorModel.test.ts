// Editor model round-trips (§2 bridge): a tree built from an overlay, edited,
// and serialized back must produce a valid overlay that renders the edits; and
// a tree saved as a résumé must round-trip positionally (slot preservation).
import { describe, expect, it } from 'vitest';
import type { ResumeDoc } from '@resume/contracts';
import resumeSeed from '../../../../data/resume.json' with { type: 'json' };
import {
  buildEditorModel,
  editorTreeToOverlay,
  treeToResume,
} from './editorModel.js';
import { applyOverlay } from './overlay.js';
import { buildViewModels } from './adapter.js';

const resume = resumeSeed as unknown as ResumeDoc;

describe('buildEditorModel', () => {
  it('builds sections with items and bullets for editable sections', () => {
    const { sections } = buildEditorModel({});
    const working = sections.find((s) => s.key === 'working')!;
    expect(working.enabled).toBe(true);
    expect(working.items.length).toBeGreaterThan(0);
    expect(working.items[0].bullets.length).toBeGreaterThan(0);
    expect(working.items[0].path).toMatch(/^\/work\/\d+\/highlights$/);
  });

  it('reflects an existing exclude/order overlay', () => {
    const { sections } = buildEditorModel({
      profile: { sections: ['working', 'skills'], filters: { working: { exclude: [] } } },
    } as never);
    expect(sections.find((s) => s.key === 'working')!.enabled).toBe(true);
    expect(sections.find((s) => s.key === 'projects')!.enabled).toBe(false);
  });
});

describe('editorTreeToOverlay round-trip', () => {
  it('identity: unedited tree → overlay renders same titles as full sections', () => {
    const tree = buildEditorModel({});
    const overlay = editorTreeToOverlay(tree, 'rt');
    expect(() => applyOverlay(overlay)).not.toThrow();
  });

  it('hiding an item excludes it from the rendered profile', () => {
    const tree = buildEditorModel({});
    const projects = tree.sections.find((s) => s.key === 'projects')!;
    const dropped = projects.items[0].title;
    projects.items[0].enabled = false;
    const overlay = editorTreeToOverlay(tree, 'rt');
    const rendered = applyOverlay(overlay);
    expect((rendered.data.projects as Array<{ title: string }>).map((p) => p.title)).not.toContain(
      dropped
    );
  });

  it('editing a bullet emits a whole-array replace patch that renders', () => {
    const tree = buildEditorModel({});
    const working = tree.sections.find((s) => s.key === 'working')!;
    working.items[0].bullets[0].text = 'EDITED BY REVIEWER';
    const overlay = editorTreeToOverlay(tree, 'rt');
    expect(
      overlay.patches.some(
        (p) => p.op === 'replace' && p.path === working.items[0].path
      )
    ).toBe(true);
    const rendered = applyOverlay(overlay);
    const item = (rendered.data.working as Array<{ title: string; content: string[] }>).find(
      (w) => w.title === working.items[0].title
    )!;
    expect(item.content).toContain('EDITED BY REVIEWER');
  });

  it('hiding a bullet drops it from the entry', () => {
    const tree = buildEditorModel({});
    const working = tree.sections.find((s) => s.key === 'working')!;
    const entry = working.items[0];
    const before = entry.bullets.length;
    entry.bullets[0].hidden = true;
    const overlay = editorTreeToOverlay(tree, 'rt');
    const rendered = applyOverlay(overlay);
    const item = (rendered.data.working as Array<{ title: string; content: string[] }>).find(
      (w) => w.title === entry.title
    )!;
    expect(item.content.length).toBe(before - 1);
  });

  it('reordering sections is reflected in profile.sections order', () => {
    const tree = buildEditorModel({});
    tree.sections = [
      tree.sections.find((s) => s.key === 'skills')!,
      ...tree.sections.filter((s) => s.key !== 'skills'),
    ];
    const overlay = editorTreeToOverlay(tree, 'rt');
    expect(overlay.profile.sections[0]).toBe('skills');
  });
});

describe('treeToResume (resume mode)', () => {
  it('round-trips: unchanged tree → same rendered view models', () => {
    const tree = buildEditorModel({}, resume);
    const rebuilt = treeToResume(tree, resume);
    expect(buildViewModels(rebuilt)).toEqual(buildViewModels(resume));
    expect(rebuilt.meta.sectionOrder).toContain('working');
  });

  it('deleting an item removes it from the rebuilt résumé', () => {
    const tree = buildEditorModel({}, resume);
    const proj = tree.sections.find((s) => s.key === 'projects')!;
    const dropped = proj.items[0].title;
    proj.items = proj.items.slice(1);
    const rebuilt = treeToResume(tree, resume);
    expect(buildViewModels(rebuilt).projects.map((p) => p.title)).not.toContain(
      dropped
    );
  });

  it('editing a bullet writes through to highlights', () => {
    const tree = buildEditorModel({}, resume);
    const work = tree.sections.find((s) => s.key === 'working')!;
    work.items[0].bullets[0].text = 'RESUME EDIT';
    const rebuilt = treeToResume(tree, resume);
    const vm = buildViewModels(rebuilt).working.find(
      (w) => w.title === work.items[0].title
    )!;
    expect(vm.content).toContain('RESUME EDIT');
  });

  it('reordering sections sets meta.sectionOrder', () => {
    const tree = buildEditorModel({}, resume);
    tree.sections = [
      tree.sections.find((s) => s.key === 'skills')!,
      ...tree.sections.filter((s) => s.key !== 'skills'),
    ];
    expect(treeToResume(tree, resume).meta.sectionOrder[0]).toBe('skills');
  });
});

describe('treeToResume position preservation', () => {
  it('no-op save reproduces work[] / projects[] exactly (overlays keep positional paths)', () => {
    const tree = buildEditorModel({}, resume);
    const rebuilt = treeToResume(tree, resume);
    expect(rebuilt.work).toEqual(resume.work);
    expect(rebuilt.projects).toEqual(resume.projects);
  });
});
