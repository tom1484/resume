import React, { useMemo, useState } from 'react';
// Deep import the pure data modules — the package barrel also re-exports
// component code (componentRegistry) that depends on apps/site's @components
// aliases, which this app doesn't define.
import { buildEditorModel, editorTreeToOverlay } from '@resume/renderer/src/data/editorModel';
import { saveOverlay } from './api.js';

// Move element at index i by dir (-1 up / +1 down), returning a new array.
function move(arr, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function Editor({ job, onSaved }) {
  const [mode, setMode] = useState('structured');
  const [tree, setTree] = useState(() => buildEditorModel(job.overlay ?? {}));
  const [coverLetter, setCoverLetter] = useState(job.cover_letter ?? '');
  const [jsonText, setJsonText] = useState('');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const overlay = useMemo(
    () => editorTreeToOverlay(tree, job.id, coverLetter),
    [tree, job.id, coverLetter]
  );

  // immutable section/item/bullet updates
  const setSections = (fn) => setTree((t) => ({ ...t, sections: fn(t.sections) }));
  const patchSection = (si, patch) =>
    setSections((secs) => secs.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const patchItem = (si, ii, patch) =>
    setSections((secs) => secs.map((s, i) => (i === si
      ? { ...s, items: s.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : s)));
  const patchBullet = (si, ii, bi, patch) =>
    setSections((secs) => secs.map((s, i) => (i === si
      ? { ...s, items: s.items.map((it, j) => (j === ii
          ? { ...it, bullets: it.bullets.map((b, k) => (k === bi ? { ...b, ...patch } : b)) } : it)) } : s)));

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const payload = mode === 'json' ? JSON.parse(jsonText) : overlay;
      await saveOverlay(job.id, payload);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor">
      <div className="editor-tabs">
        <button className={mode === 'structured' ? 'on' : ''} onClick={() => setMode('structured')}>Structured</button>
        <button className={mode === 'json' ? 'on' : ''}
          onClick={() => { setJsonText(JSON.stringify(overlay, null, 2)); setMode('json'); }}>JSON</button>
        <button className="save" onClick={save} disabled={saving}>{saving ? 'saving…' : 'Save'}</button>
      </div>
      {err && <p className="editor-err">⚠ {err}</p>}

      {mode === 'json' ? (
        <textarea className="json-editor" value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
      ) : (
        <div className="tree">
          {tree.sections.map((s, si) => (
            <div key={s.key} className={`sec ${s.enabled ? '' : 'off'}`}>
              <div className="row">
                <input type="checkbox" checked={s.enabled} onChange={(e) => patchSection(si, { enabled: e.target.checked })} />
                <strong>{s.label}</strong>
                <span className="rowbtns">
                  <button onClick={() => setSections((x) => move(x, si, -1))}>↑</button>
                  <button onClick={() => setSections((x) => move(x, si, +1))}>↓</button>
                </span>
              </div>
              {s.enabled && s.items.map((it, ii) => (
                <div key={it.title + ii} className={`item ${it.enabled ? '' : 'off'}`}>
                  <div className="row">
                    <input type="checkbox" checked={it.enabled} onChange={(e) => patchItem(si, ii, { enabled: e.target.checked })} />
                    <span>{it.title}</span>
                    <span className="rowbtns">
                      <button onClick={() => patchSection(si, { items: move(s.items, ii, -1) })}>↑</button>
                      <button onClick={() => patchSection(si, { items: move(s.items, ii, +1) })}>↓</button>
                    </span>
                  </div>
                  {it.enabled && s.editable && it.bullets.map((b, bi) => (
                    <div key={bi} className={`bullet ${b.hidden ? 'off' : ''}`}>
                      <textarea value={b.text} disabled={b.hidden}
                        onChange={(e) => patchBullet(si, ii, bi, { text: e.target.value })} />
                      <div className="bulletbtns">
                        <button onClick={() => patchBullet(si, ii, bi, { hidden: !b.hidden })}>{b.hidden ? 'show' : 'hide'}</button>
                        <button onClick={() => patchItem(si, ii, { bullets: move(it.bullets, bi, -1) })}>↑</button>
                        <button onClick={() => patchItem(si, ii, { bullets: move(it.bullets, bi, +1) })}>↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <div className="sec">
            <strong>Cover letter</strong>
            <textarea className="cover-edit" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}
