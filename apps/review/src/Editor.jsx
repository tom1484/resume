import React, { useEffect, useMemo, useState } from 'react';
import { ResumeTree } from '@resume/renderer/src/editor/ResumeTree';
import { buildEditorModel, editorTreeToOverlay } from '@resume/renderer/src/data/editorModel';
import { saveOverlay } from './api.js';

// Overlay editor, shown in a modal over the review detail. Structured tab
// (include/exclude + hide + drag reorder + rephrase) + JSON escape hatch.
// Builds the tree against the CURRENT canonical résumé (fetched) so paths
// and base text match what the server validates against.
export function EditorModal({ job, onClose, onSaved }) {
  const [base, setBase] = useState(null);
  const [mode, setMode] = useState('structured');
  const [tree, setTree] = useState(null);
  const [coverLetter, setCoverLetter] = useState(job.cover_letter ?? '');
  const [jsonText, setJsonText] = useState('');
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/resume').then((r) => r.json()).then((doc) => {
      setBase(doc);
      setTree(buildEditorModel(job.overlay ?? {}, doc));
    }).catch((e) => setErr(`couldn't load résumé: ${e.message}`));
  }, [job.id]);

  const overlay = useMemo(
    () => (tree && base ? editorTreeToOverlay(tree, job.id, coverLetter, base) : null),
    [tree, base, job.id, coverLetter]
  );

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      await saveOverlay(job.id, mode === 'json' ? JSON.parse(jsonText) : overlay);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>Edit overlay — {job.company}</strong>
          <span className="editor-tabs">
            <button className={mode === 'structured' ? 'on' : ''} onClick={() => setMode('structured')}>Structured</button>
            <button className={mode === 'json' ? 'on' : ''}
              onClick={() => { if (overlay) setJsonText(JSON.stringify(overlay, null, 2)); setMode('json'); }}>JSON</button>
            <button className="save" onClick={save} disabled={saving || !tree}>{saving ? 'saving…' : 'Save'}</button>
            <button onClick={onClose}>Close</button>
          </span>
        </div>
        {err && <p className="editor-err">⚠ {err}</p>}
        {!tree ? <p className="muted">Loading…</p> : mode === 'json' ? (
          <textarea className="json-editor" value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} />
        ) : (
          <div className="modal-body">
            <ResumeTree tree={tree} onChange={setTree} mode="overlay" />
            <h4>Cover letter</h4>
            <textarea className="cover-edit" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}
