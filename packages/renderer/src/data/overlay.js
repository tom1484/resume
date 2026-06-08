// Application overlay engine: turns a per-job overlay (profile selection +
// RFC-6902 patches, see overlay.schema.json) into a renderable profile.
// The canonical resume document is NEVER mutated — patches are applied to
// a deep clone, then view models are rebuilt from the patched document.
import jsonpatch from 'fast-json-patch';
import resume from '../../../../data/resume.json';
import { buildViewModels } from './adapter';
import { buildProfileFrom } from './profiles';

// Apply an overlay to a resume document; returns { id, name, description, data }.
// Throws on a patch that doesn't apply cleanly or an unknown section key.
export function applyOverlay(overlay, resumeDoc = resume) {
  const patches = overlay.patches ?? [];
  const patchError = jsonpatch.validate(patches, resumeDoc);
  if (patchError) {
    throw new Error(
      `overlay ${overlay.jobId}: patch #${patchError.index} (${patchError.name}) does not apply at ${patchError.operation?.path}`
    );
  }
  const patched = jsonpatch.applyPatch(jsonpatch.deepClone(resumeDoc), patches).newDocument;
  const models = buildViewModels(patched);

  for (const sectionKey of overlay.profile.sections) {
    if (!(sectionKey in models)) {
      throw new Error(`overlay ${overlay.jobId}: unknown section "${sectionKey}"`);
    }
  }

  return buildProfileFrom(models, `application:${overlay.jobId}`, {
    name: overlay.profile.name ?? `Application ${overlay.jobId}`,
    description: overlay.profile.description,
    sections: overlay.profile.sections,
    filters: overlay.profile.filters,
  });
}
