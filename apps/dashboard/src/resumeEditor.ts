// Central re-export of the renderer's ALIAS-FREE deep-importable surface. These
// modules (data/editorModel, editor/ResumeTree, data/print) import only
// @resume/contracts + fast-json-patch + dnd-kit + react — NO internal
// @components/@config/@contexts/@css aliases — so they bundle cleanly in the
// dashboard without mirroring the renderer's Vite aliases. (The résumé CANVAS,
// which DOES need those aliases, is iframed from the bare host instead — see
// ResumeCanvas.tsx.)
export {
  buildEditorModel,
  editorTreeToOverlay,
  treeToResume,
  type EditorTree,
  type SectionNode,
  type ItemNode,
  type BulletNode,
} from '@resume/renderer/src/data/editorModel';

export { ResumeTree } from '@resume/renderer/src/editor/ResumeTree';

export {
  getPrint,
  pageCss,
  PRINT_DEFAULTS,
  PAPER_SIZES,
  type PrintSettings,
} from '@resume/renderer/src/data/print';
