// Editor model: a UI-friendly tree bridging the résumé/overlay and the
// structured editor. One tree shape feeds two modes:
//   - overlay mode  (review app): editorTreeToOverlay → application overlay
//   - resume mode   (renderer):   treeToResume → a new canonical résumé doc
//
// Tree: { sections: [ { key, label, list, editable, enabled,
//                       items: [ { id, title, source, index, path,
//                                  bullets: [ { id, text, hidden? } ] } ] } ] }
// ids are stable within a session (for dnd-kit keys). Items are keyed by
// `title` for overlay exclude/order; bullet edits serialize as a whole-array
// replace (overlay) or written straight into highlights (resume).
import jsonpatch from 'fast-json-patch';
import bundledResume from '../../../../data/resume.json';

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
const SECTION_KEYS = SECTIONS.map((s) => s.key);

const orderRank = (list, key, fallback = 99) => {
  const i = (list ?? []).indexOf(key);
  return i === -1 ? fallback : i;
};

// Build the section/item/bullet tree from a résumé doc, optionally reflecting
// an overlay's selection/order/patches. `sectionOrderKeys` overrides display
// order (resume mode uses doc.meta.sectionOrder).
export function buildEditorModel(overlay = {}, doc = bundledResume, sectionOrderKeys = null) {
  const profile = overlay.profile ?? { sections: SECTION_KEYS };
  const enabledSet = new Set(profile.sections ?? SECTION_KEYS);
  const filters = profile.filters ?? {};
  const patched = jsonpatch.applyPatch(jsonpatch.deepClone(doc), overlay.patches ?? [], false, false).newDocument;
  const order = sectionOrderKeys ?? profile.sections ?? SECTION_KEYS;

  const sections = SECTIONS
    .slice()
    .sort((a, b) => orderRank(order, a.key) - orderRank(order, b.key))
    .map((s) => {
      const node = { key: s.key, label: s.label, enabled: enabledSet.has(s.key), list: !!s.list, editable: !!s.editable, items: [] };
      if (!s.list) return node;
      const f = filters[s.key] ?? {};
      const exclude = new Set(f.exclude ?? []);
      const items = [];
      (patched[s.source] ?? []).forEach((entry, idx) => {
        if (s.pick && !s.pick(entry)) return;
        const title = entry[s.titleKey];
        const bullets = s.editable
          ? (entry.highlights ?? []).map((text, j) => ({ id: `${s.key}-${idx}-${j}`, text }))
          : [];
        items.push({ id: `${s.key}-${idx}`, title, enabled: !exclude.has(title), source: s.source, index: idx, path: `/${s.source}/${idx}/highlights`, bullets });
      });
      if (f.order) items.sort((a, b) => orderRank(f.order, a.title) - orderRank(f.order, b.title));
      node.items = items;
      return node;
    });

  return { sections };
}

// ---- overlay mode -------------------------------------------------------
export function editorTreeToOverlay(tree, jobId, coverLetter, doc = bundledResume) {
  const sections = tree.sections.filter((s) => s.enabled).map((s) => s.key);
  const filters = {};
  const patches = [];
  for (const s of tree.sections) {
    if (!s.list || !s.enabled) continue;
    const excluded = s.items.filter((it) => !it.enabled).map((it) => it.title);
    const ord = s.items.map((it) => it.title);
    const f = {};
    if (excluded.length) f.exclude = excluded;
    if (ord.length) f.order = ord;
    if (Object.keys(f).length) filters[s.key] = f;
    if (!s.editable) continue;
    for (const it of s.items) {
      const base = doc[it.source]?.[it.index]?.highlights ?? [];
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
    audit: { claims: [], unsupported: [] },
  };
  if (coverLetter != null) overlay.coverLetter = coverLetter;
  return overlay;
}

// ---- resume mode --------------------------------------------------------
// Rebuild a canonical résumé doc from the tree. Reordering/deleting items and
// editing/deleting bullets are written straight into the source arrays;
// section display order is saved to meta.sectionOrder.
export function treeToResume(tree, baseDoc) {
  const out = jsonpatch.deepClone(baseDoc);
  out.meta = { ...(out.meta ?? {}), sectionOrder: tree.sections.map((s) => s.key) };

  // Build per-source, per-section queues of edited entries in editor order.
  const queues = {}; // source -> sectionKey -> [entry]
  for (const s of tree.sections) {
    if (!s.list) continue;
    for (const it of s.items) {
      const orig = baseDoc[it.source]?.[it.index];
      if (!orig) continue;
      const entry = jsonpatch.deepClone(orig);
      if (s.editable) entry.highlights = it.bullets.filter((b) => !b.hidden).map((b) => b.text);
      ((queues[it.source] ??= {})[s.key] ??= []).push(entry);
    }
  }

  // Which display section an original entry belongs to (work/projects split).
  const sectionOf = (source, entry) =>
    SECTIONS.find((sec) => sec.source === source && (!sec.pick || sec.pick(entry)))?.key;

  // Rebuild each source array IN PLACE: walk the original slots, and at each
  // slot pull the next entry from that slot's section queue. This applies
  // within-section reorder/edits/deletes while keeping each section's slots
  // in their original absolute positions — so a no-op save reproduces the
  // array exactly and existing overlays' positional patches stay valid.
  for (const source of Object.keys(queues)) {
    const rebuilt = [];
    for (const orig of baseDoc[source] ?? []) {
      const q = queues[source][sectionOf(source, orig)];
      if (q && q.length) rebuilt.push(q.shift());
    }
    out[source] = rebuilt;
  }
  return out;
}
