// Editor model (§2 bridge): a UI-friendly tree bridging the résumé/overlay and
// the structured editor. One tree shape feeds two modes:
//   - overlay mode  (dashboard review): editorTreeToOverlay → application overlay
//   - resume mode   (dashboard résumé editor): treeToResume → a new canonical doc
//
// Tree: { sections: [ { key, label, list, editable, enabled,
//                       items: [ { id, title, source, index, path,
//                                  bullets: [ { id, text, hidden? } ] } ] } ] }
// ids are stable within a session (for dnd-kit keys). Items are keyed by `title`
// for overlay exclude/order; bullet edits serialize as a whole-array replace
// (overlay) or written straight into highlights (resume).
//
// The section list + the work/projects split are NOT restated here: they derive
// from the §1 SECTION_REGISTRY (key/label/list/editable/source/titleKey/pick),
// so this file can never drift from the adapter/tailor split rule again.
import jsonpatch, { type Operation } from 'fast-json-patch';
import { SECTION_REGISTRY } from '@resume/contracts';
import type { Overlay, ResumeDoc, SectionMeta } from '@resume/contracts';
import bundledResume from '../../../../data/resume.json' with { type: 'json' };

const seed = bundledResume as unknown as ResumeDoc;

// Editor section descriptor — the subset of the registry the tree needs.
interface EditorSection {
  key: string;
  label: string;
  list: boolean;
  editable: boolean;
  source?: string | null;
  titleKey?: string;
  pick?: (e: { track?: string; kind?: string }) => boolean;
}

// Derived from the §1 registry (the one list) — section keys + the work/projects
// split (`pick`) are never restated here.
const SECTIONS: EditorSection[] = (SECTION_REGISTRY as readonly SectionMeta[]).map(
  (s) => ({
    key: s.key,
    label: s.label,
    list: s.list,
    editable: s.editable,
    source: s.source,
    titleKey: s.titleKey,
    pick: s.pick as ((e: { track?: string; kind?: string }) => boolean) | undefined,
  })
);
const SECTION_KEYS = SECTIONS.map((s) => s.key);

export interface BulletNode {
  id: string;
  text: string;
  hidden?: boolean;
}
export interface ItemNode {
  id: string;
  title: string;
  enabled: boolean;
  source: string;
  index: number;
  path: string;
  bullets: BulletNode[];
}
export interface SectionNode {
  key: string;
  label: string;
  enabled: boolean;
  list: boolean;
  editable: boolean;
  items: ItemNode[];
}
export interface EditorTree {
  sections: SectionNode[];
}

const orderRank = (
  list: readonly string[] | undefined,
  key: string,
  fallback = 99
): number => {
  const i = (list ?? []).indexOf(key);
  return i === -1 ? fallback : i;
};

// Build the section/item/bullet tree from a résumé doc, optionally reflecting an
// overlay's selection/order/patches. `sectionOrderKeys` overrides display order
// (resume mode uses doc.meta.sectionOrder).
export function buildEditorModel(
  overlay: Partial<Overlay> = {},
  doc: ResumeDoc = seed,
  sectionOrderKeys: string[] | null = null
): EditorTree {
  const profile = overlay.profile ?? { sections: SECTION_KEYS };
  const enabledSet = new Set(profile.sections ?? SECTION_KEYS);
  const filters = (profile.filters ?? {}) as Record<
    string,
    { exclude?: string[]; order?: string[] }
  >;
  const patched = jsonpatch.applyPatch(
    jsonpatch.deepClone(doc),
    (overlay.patches ?? []) as Operation[],
    false,
    false
  ).newDocument as Record<string, Array<Record<string, unknown>>>;
  const order = sectionOrderKeys ?? profile.sections ?? SECTION_KEYS;

  const sections = SECTIONS.slice()
    .sort((a, b) => orderRank(order, a.key) - orderRank(order, b.key))
    .map((s) => {
      const node: SectionNode = {
        key: s.key,
        label: s.label,
        enabled: enabledSet.has(s.key),
        list: !!s.list,
        editable: !!s.editable,
        items: [],
      };
      if (!s.list) return node;
      const f = filters[s.key] ?? {};
      const exclude = new Set(f.exclude ?? []);
      const items: ItemNode[] = [];
      (patched[s.source as string] ?? []).forEach((entry, idx) => {
        if (s.pick && !s.pick(entry as { track?: string; kind?: string })) return;
        const title = entry[s.titleKey as string] as string;
        const bullets = s.editable
          ? ((entry.highlights ?? []) as string[]).map((text, j) => ({
              id: `${s.key}-${idx}-${j}`,
              text,
            }))
          : [];
        items.push({
          id: `${s.key}-${idx}`,
          title,
          enabled: !exclude.has(title),
          source: s.source as string,
          index: idx,
          path: `/${s.source}/${idx}/highlights`,
          bullets,
        });
      });
      if (f.order)
        items.sort(
          (a, b) => orderRank(f.order, a.title) - orderRank(f.order, b.title)
        );
      node.items = items;
      return node;
    });

  return { sections };
}

// ---- overlay mode -------------------------------------------------------
export function editorTreeToOverlay(
  tree: EditorTree,
  jobId: string,
  coverLetter?: string | null,
  doc: ResumeDoc = seed
): Overlay {
  const sections = tree.sections.filter((s) => s.enabled).map((s) => s.key);
  const filters: Record<string, { exclude?: string[]; order?: string[] }> = {};
  const patches: { op: 'replace'; path: string; value: string[] }[] = [];
  for (const s of tree.sections) {
    if (!s.list || !s.enabled) continue;
    const excluded = s.items.filter((it) => !it.enabled).map((it) => it.title);
    const ord = s.items.map((it) => it.title);
    const f: { exclude?: string[]; order?: string[] } = {};
    if (excluded.length) f.exclude = excluded;
    if (ord.length) f.order = ord;
    if (Object.keys(f).length) filters[s.key] = f;
    if (!s.editable) continue;
    for (const it of s.items) {
      const base =
        ((doc as unknown as Record<string, Array<{ highlights?: string[] }>>)[
          it.source
        ]?.[it.index]?.highlights ?? []) as string[];
      const next = it.bullets.filter((b) => !b.hidden).map((b) => b.text);
      if (next.length !== base.length || next.some((t, i) => t !== base[i])) {
        patches.push({ op: 'replace', path: it.path, value: next });
      }
    }
  }
  const overlay = {
    jobId,
    profile: {
      name: `Application ${jobId}`,
      sections,
      ...(Object.keys(filters).length ? { filters } : {}),
    },
    patches,
    audit: { claims: [], unsupported: [] },
  } as unknown as Overlay;
  if (coverLetter != null) overlay.coverLetter = coverLetter;
  return overlay;
}

// ---- resume mode --------------------------------------------------------
// Rebuild a canonical résumé doc from the tree. Reordering/deleting items and
// editing/deleting bullets are written straight into the source arrays; section
// display order is saved to meta.sectionOrder. Slot-preservation (§2 invariant):
// a no-op save reproduces source arrays positionally → existing overlay patch
// paths stay valid.
export function treeToResume(tree: EditorTree, baseDoc: ResumeDoc): ResumeDoc {
  const out = jsonpatch.deepClone(baseDoc) as ResumeDoc &
    Record<string, unknown>;
  out.meta = {
    ...(out.meta ?? {}),
    sectionOrder: tree.sections.map((s) => s.key),
  } as ResumeDoc['meta'];

  // Build per-source, per-section queues of edited entries in editor order.
  const queues: Record<string, Record<string, Array<Record<string, unknown>>>> =
    {};
  for (const s of tree.sections) {
    if (!s.list) continue;
    for (const it of s.items) {
      const orig = (
        baseDoc as unknown as Record<string, Array<Record<string, unknown>>>
      )[it.source]?.[it.index];
      if (!orig) continue;
      const entry = jsonpatch.deepClone(orig) as Record<string, unknown>;
      if (s.editable)
        entry.highlights = it.bullets
          .filter((b) => !b.hidden)
          .map((b) => b.text);
      ((queues[it.source] ??= {})[s.key] ??= []).push(entry);
    }
  }

  // Which display section an original entry belongs to (work/projects split).
  const sectionOf = (
    source: string,
    entry: { track?: string; kind?: string }
  ): string | undefined =>
    SECTIONS.find((sec) => sec.source === source && (!sec.pick || sec.pick(entry)))
      ?.key;

  // Rebuild each source array IN PLACE: walk the original slots, and at each slot
  // pull the next entry from that slot's section queue. This applies
  // within-section reorder/edits/deletes while keeping each section's slots in
  // their original absolute positions — so a no-op save reproduces the array
  // exactly and existing overlays' positional patches stay valid.
  for (const source of Object.keys(queues)) {
    const rebuilt: Array<Record<string, unknown>> = [];
    for (const orig of (
      baseDoc as unknown as Record<string, Array<Record<string, unknown>>>
    )[source] ?? []) {
      const key = sectionOf(source, orig as { track?: string; kind?: string });
      const q = key ? queues[source][key] : undefined;
      if (q && q.length) rebuilt.push(q.shift() as Record<string, unknown>);
    }
    (out as Record<string, unknown>)[source] = rebuilt;
  }
  return out;
}
