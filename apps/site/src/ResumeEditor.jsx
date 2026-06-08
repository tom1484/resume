import React, { useMemo, useState } from 'react';
import { ResumeTree } from '@resume/renderer/src/editor/ResumeTree';
import { buildEditorModel, treeToResume } from '@resume/renderer/src/data/editorModel';

// Editor for the canonical résumé (/resume). Structured tab (drag reorder,
// rephrase, delete) + JSON escape hatch. Saves to PUT /api/resume, which
// snapshots a new version (history). onSaved re-fetches + re-renders.
export function ResumeEditor({ doc, onSaved, onClose }) {
  const [mode, setMode] = useState('structured');
  const [tree, setTree] = useState(() => buildEditorModel({}, doc));
  const [jsonText, setJsonText] = useState('');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const edited = useMemo(() => treeToResume(tree, doc), [tree, doc]);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const payload = mode === 'json' ? JSON.parse(jsonText) : edited;
      const r = await fetch('/api/resume', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
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

  return (
    <div className="print:hidden" style={{ maxWidth: 820, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ flex: 1 }}>Edit résumé</strong>
        <button onClick={() => setMode('structured')} style={tab(mode === 'structured')}>Structured</button>
        <button onClick={() => { setJsonText(JSON.stringify(edited, null, 2)); setMode('json'); }} style={tab(mode === 'json')}>JSON</button>
        <button onClick={save} disabled={saving} style={{ ...btn, background: '#137333', color: '#fff', borderColor: '#137333' }}>{saving ? 'saving…' : 'Save'}</button>
        <button onClick={onClose} style={btn}>Close</button>
      </div>
      {err && <p style={{ color: '#c5221f', fontSize: 13 }}>⚠ {err}</p>}
      {mode === 'json'
        ? <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false}
            style={{ width: '100%', height: '70vh', font: '12px/1.5 ui-monospace, monospace', padding: 10, border: '1px solid #d0d3d9', borderRadius: 6 }} />
        : <ResumeTree tree={tree} onChange={setTree} mode="resume" />}
    </div>
  );
}

const btn = { border: '1px solid #d0d3d9', background: '#fff', borderRadius: 6, padding: '6px 12px', font: 'inherit', cursor: 'pointer' };
const tab = (on) => ({ ...btn, fontSize: 12, padding: '4px 10px', ...(on ? { background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' } : {}) });
