// Editor model: a UI-friendly tree bridging the overlay and a structured
// editor. buildEditorModel(overlay) returns sections → items → bullets (with
// resume.json paths), reflecting the overlay's current selection/edits.
// editorTreeToOverlay(tree, jobId, coverLetter) serializes it back.
//
// Design choices that keep this tractable:
//  - items are keyed by `title` (consistent with applyFilter's exclude/order)
//  - bullet edits serialize as ONE `replace` of the entry's whole
//    `/…/highlights` array (no per-index remove → no RFC-6902 index-shift
//    headaches); a patch is emitted only when the array actually differs
//    from base resume.json
//  - user edits are trusted (their own claims): audit.unsupported = []
import jsonpatch from 'fast-json-patch';
import resume from './resume.json';

// Section map: order matches the 'full' profile. `editable` sections expose
// per-bullet editing; `list` sections expose item toggle/reorder.
const SECTIONS = [
  { key: 'personalInfo', label: 'Header', list: false },
  { key: 'education', label: 'Education', list: true, source: 'education', titleKey: 'institution' },
  { key: 'academics', label: 'Academic Experience', list: true, editable: true, source: 'work', titleKey: 'name', pick: (e) => e['x-section'] === 'academic' },
  { key: 'working', label: 'Experience', list: true, editable: true, source: 'work', titleKey: 'name', pick: (e) => e['x-section'] !== 'academic' },
  { key: 'publications', label: 'Publications', list: true, source: 'publications', titleKey: 'name' },
  { key: 'competitions', label: 'Competitions', list: true, editable: true, source: 'projects', titleKey: 'name', pick: (e) => e['x-type'] === 'competition' },
  { key: 'projects', label: 'Projects', list: true, editable: true, source: 'projects', titleKey: 'name', pick: (e) => e['x-type'] !== 'competition' },
  { key: 'extracurriculars', label: 'Activities', list: true, editable: true, source: 'volunteer', titleKey: 'organization' },
  { key: 'skills', label: 'Skills', list: false },
];

const baseHighlights = (source, idx) => resume[source]?.[idx]?.highlights ?? [];

export function buildEditorModel(overlay = {}) {
  const profile = overlay.profile ?? { sections: SECTIONS.map((s) => s.key) };
  const enabledSet = new Set(profile.sections ?? []);
  const filters = profile.filters ?? {};
  // current bullet text reflects existing patches
  const patched = jsonpatch.applyPatch(jsonpatch.deepClone(resume), overlay.patches ?? [], false, false).newDocument;

  const sections = SECTIONS
    // keep selected order first, then any unselected sections
    .map((s) => s)
    .sort((a, b) => {
      const ai = (profile.sections ?? []).indexOf(a.key);
      const bi = (profile.sections ?? []).indexOf(b.key);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map((s) => {
      const node = { key: s.key, label: s.label, enabled: enabledSet.has(s.key), list: !!s.list, editable: !!s.editable, items: [] };
      if (!s.list) return node;
      const f = filters[s.key] ?? {};
      const exclude = new Set(f.exclude ?? []);
      const items = [];
      (resume[s.source] ?? []).forEach((entry, idx) => {
        if (s.pick && !s.pick(entry)) return;
        const title = entry[s.titleKey];
        const bullets = s.editable
          ? (patched[s.source][idx].highlights ?? []).map((text, j) => ({ text, baseIndex: j }))
          : [];
        items.push({ title, enabled: !exclude.has(title), source: s.source, index: idx, path: `/${s.source}/${idx}/highlights`, bullets });
      });
      // apply saved order
      if (f.order) {
        const rank = (t) => { const i = f.order.indexOf(t); return i === -1 ? f.order.length : i; };
        items.sort((a, b) => rank(a.title) - rank(b.title));
      }
      node.items = items;
      return node;
    });

  return { sections };
}

export function editorTreeToOverlay(tree, jobId, coverLetter) {
  const sections = tree.sections.filter((s) => s.enabled).map((s) => s.key);
  const filters = {};
  const patches = [];

  for (const s of tree.sections) {
    if (!s.list || !s.enabled) continue;
    const excluded = s.items.filter((it) => !it.enabled).map((it) => it.title);
    const order = s.items.map((it) => it.title);
    const f = {};
    if (excluded.length) f.exclude = excluded;
    if (order.length) f.order = order;
    if (Object.keys(f).length) filters[s.key] = f;

    if (!s.editable) continue;
    for (const it of s.items) {
      const base = baseHighlights(it.source, it.index);
      const next = it.bullets.filter((b) => !b.hidden).map((b) => b.text);
      if (next.length !== base.length || next.some((t, i) => t !== base[i])) {
        patches.push({ op: 'replace', path: it.path, value: next });
      }
    }
  }

  const overlay = {
    jobId,
    profile: { name: `Application ${jobId}`, sections, ...(Object.keys(filters).length ? { filters } : {}) },
    patches,
    audit: { claims: [], unsupported: [] }, // reviewer edits are trusted
  };
  if (coverLetter != null) overlay.coverLetter = coverLetter;
  return overlay;
}
