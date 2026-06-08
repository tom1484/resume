import React, { useMemo, useRef, useState } from 'react';
import { ResumeTree } from '@resume/renderer/src/editor/ResumeTree';
import { buildEditorModel, treeToResume } from '@resume/renderer/src/data/editorModel';

// Editor for the canonical résumé (/resume). Structured tab (drag reorder,
// rephrase, delete) + JSON escape hatch. Saves to PUT /api/resume (server
// snapshots a version). Export/Import give a DB-independent backup: Export
// downloads the current document as resume.json; Import loads a JSON file
// into the editor (review, then Save to persist a new version).
export function ResumeEditor({ doc, onSaved, onClose }) {
  const [mode, setMode] = useState('structured');
  const [baseDoc, setBaseDoc] = useState(doc);
  const [tree, setTree] = useState(() => buildEditorModel({}, doc));
  const [jsonText, setJsonText] = useState('');
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  // the document as currently edited (structured tree applied, or raw JSON)
  const edited = useMemo(() => treeToResume(tree, baseDoc), [tree, baseDoc]);
  const currentDoc = () => (mode === 'json' ? JSON.parse(jsonText) : edited);

  const save = async () => {
    setSaving(true); setErr(null); setNote(null);
    try {
      const r = await fetch('/api/resume', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentDoc()),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const exportJson = () => {
    setErr(null);
    let data;
    try { data = currentDoc(); } catch (e) { setErr(`can't export: ${e.message}`); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `resume-${stamp}.json`; a.click();
    URL.revokeObjectURL(url);
    setNote('exported (not yet saved to DB — use Save to persist)');
  };

  const importJson = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr(null); setNote(null);
    try {
      const imported = JSON.parse(await file.text());
      if (!imported?.basics || !Array.isArray(imported.work)) {
        throw new Error('not a résumé document (need basics + work[])');
      }
      setBaseDoc(imported);
      setTree(buildEditorModel({}, imported));
      if (mode === 'json') setJsonText(JSON.stringify(imported, null, 2));
      setNote(`imported "${file.name}" — review, then Save to persist`);
    } catch (e2) {
      setErr(`import failed: ${e2.message}`);
    }
  };

  return (
    <div className="print:hidden" style={{ maxWidth: 820, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
        <strong style={{ flex: 1 }}>Edit résumé</strong>
        <button onClick={() => setMode('structured')} style={tab(mode === 'structured')}>Structured</button>
        <button onClick={() => { setJsonText(JSON.stringify(edited, null, 2)); setMode('json'); }} style={tab(mode === 'json')}>JSON</button>
        <button onClick={exportJson} style={btn} title="download the current résumé as JSON">⬇ Export</button>
        <button onClick={() => fileRef.current?.click()} style={btn} title="load a résumé JSON into the editor">⬆ Import</button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={importJson} style={{ display: 'none' }} />
        <button onClick={save} disabled={saving} style={{ ...btn, background: '#137333', color: '#fff', borderColor: '#137333' }}>{saving ? 'saving…' : 'Save'}</button>
        <button onClick={onClose} style={btn}>Close</button>
      </div>
      {err && <p style={{ color: '#c5221f', fontSize: 13 }}>⚠ {err}</p>}
      {note && <p style={{ color: '#137333', fontSize: 13 }}>{note}</p>}
      {mode === 'json'
        ? <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false}
            style={{ width: '100%', height: '68vh', font: '12px/1.5 ui-monospace, monospace', padding: 10, border: '1px solid #d0d3d9', borderRadius: 6 }} />
        : <ResumeTree tree={tree} onChange={setTree} mode="resume" />}
    </div>
  );
}

const btn = { border: '1px solid #d0d3d9', background: '#fff', borderRadius: 6, padding: '6px 12px', font: 'inherit', cursor: 'pointer' };
const tab = (on) => ({ ...btn, fontSize: 12, padding: '4px 10px', ...(on ? { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' } : {}) });
