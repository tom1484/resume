// Thin API client. Same-origin: the review SPA is served by the API service.
const json = (r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

export const listJobs = (status) => fetch(`/api/jobs?status=${status}`).then(json);
export const getJob = (id) => fetch(`/api/jobs/${encodeURIComponent(id)}`).then(json);
export const approve = (id) => fetch(`/api/jobs/${encodeURIComponent(id)}/approve`, { method: 'POST' }).then(json);
export const reject = (id, reason) =>
  fetch(`/api/jobs/${encodeURIComponent(id)}/reject`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
  }).then(json);
export const label = (id, value) =>
  fetch(`/api/jobs/${encodeURIComponent(id)}/label`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: value }),
  }).then(json);
