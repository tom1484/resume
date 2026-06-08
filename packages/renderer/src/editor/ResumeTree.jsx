// Shared structured editor tree, used by both the résumé editor (renderer)
// and the overlay editor (review app). Controlled: takes `tree` + `onChange`.
// Mode flags decide which affordances show:
//   mode 'resume'  → delete (trash) on items/bullets; no visibility toggles
//   mode 'overlay' → include/exclude checkboxes on sections/items + bullet
//                    hide checkbox; no delete
// Reorder is drag-and-drop (dnd-kit, touch + mouse) at all three levels.
import React from 'react';
import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableList({ ids, onReorder, children }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
      if (over && active.id !== over.id) onReorder(ids.indexOf(active.id), ids.indexOf(over.id));
    }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
    </DndContext>
  );
}

function Row({ id, children, indent = 0 }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform), transition,
      opacity: isDragging ? 0.5 : 1, display: 'flex', alignItems: 'flex-start', gap: 6,
      marginLeft: indent, padding: '2px 0',
    }}>
      <span {...attributes} {...listeners} title="drag to reorder"
        style={{ cursor: 'grab', color: '#aaa', userSelect: 'none', fontSize: 13, lineHeight: '1.6', touchAction: 'none' }}>⋮⋮</span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

const move = (arr, from, to) => {
  const next = arr.slice();
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
};

export function ResumeTree({ tree, onChange, mode = 'resume' }) {
  const overlay = mode === 'overlay';
  const set = (sections) => onChange({ ...tree, sections });
  const updSection = (si, patch) => set(tree.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const updItem = (si, ii, patch) => updSection(si, { items: tree.sections[si].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) });
  const updBullet = (si, ii, bi, patch) => updItem(si, ii, { bullets: tree.sections[si].items[ii].bullets.map((b, k) => (k === bi ? { ...b, ...patch } : b)) });
  const delItem = (si, ii) => updSection(si, { items: tree.sections[si].items.filter((_, j) => j !== ii) });
  const delBullet = (si, ii, bi) => updItem(si, ii, { bullets: tree.sections[si].items[ii].bullets.filter((_, k) => k !== bi) });

  const trash = (onClick) => (
    <button onClick={onClick} title="delete" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c5221f', fontSize: 13 }}>🗑</button>
  );

  return (
    <div style={{ fontSize: 13 }}>
      <SortableList ids={tree.sections.map((s) => s.key)} onReorder={(f, t) => set(move(tree.sections, f, t))}>
        {tree.sections.map((s, si) => (
          <Row key={s.key} id={s.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              {overlay && <input type="checkbox" checked={s.enabled} onChange={(e) => updSection(si, { enabled: e.target.checked })} />}
              <span style={{ opacity: overlay && !s.enabled ? 0.4 : 1 }}>{s.label}</span>
            </div>
            {(!overlay || s.enabled) && s.items.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <SortableList ids={s.items.map((it) => it.id)} onReorder={(f, t) => updSection(si, { items: move(s.items, f, t) })}>
                  {s.items.map((it, ii) => (
                    <Row key={it.id} id={it.id} indent={12}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {overlay && <input type="checkbox" checked={it.enabled} onChange={(e) => updItem(si, ii, { enabled: e.target.checked })} />}
                        <span style={{ flex: 1, opacity: overlay && !it.enabled ? 0.4 : 1 }}>{it.title}</span>
                        {!overlay && trash(() => delItem(si, ii))}
                      </div>
                      {(!overlay || it.enabled) && it.bullets.length > 0 && (
                        <div style={{ marginTop: 3 }}>
                          <SortableList ids={it.bullets.map((b) => b.id)} onReorder={(f, t) => updItem(si, ii, { bullets: move(it.bullets, f, t) })}>
                            {it.bullets.map((b, bi) => (
                              <Row key={b.id} id={b.id} indent={12}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                  {overlay && <input type="checkbox" title="show in this application" checked={!b.hidden} onChange={(e) => updBullet(si, ii, bi, { hidden: !e.target.checked })} style={{ marginTop: 6 }} />}
                                  <textarea value={b.text} disabled={overlay && b.hidden}
                                    onChange={(e) => updBullet(si, ii, bi, { text: e.target.value })}
                                    style={{ flex: 1, minHeight: 40, font: 'inherit', padding: 5, border: '1px solid #e0e2e6', borderRadius: 5, resize: 'vertical', opacity: overlay && b.hidden ? 0.4 : 1 }} />
                                  {!overlay && trash(() => delBullet(si, ii, bi))}
                                </div>
                              </Row>
                            ))}
                          </SortableList>
                        </div>
                      )}
                    </Row>
                  ))}
                </SortableList>
              </div>
            )}
          </Row>
        ))}
      </SortableList>
    </div>
  );
}
