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
export const getAnswers = () => fetch('/api/answers').then(json);
export const saveAnswer = (key, question, answer) =>
  fetch(`/api/answers/${encodeURIComponent(key)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, answer }),
  }).then(json);
