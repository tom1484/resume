// Typed, same-origin API client for the v2 dashboard. Every shape comes from
// @resume/contracts (the single source of truth) — never restated here. The API
// is served from the same origin (the jobs-api container hosts this SPA at /),
// behind nginx proxy manager auth, so plain relative `fetch` carries the session.
import type {
  JobListItem,
  JobDetail,
  JobStatus,
  Overlay,
  ResumeDoc,
  Answer,
  DashboardSummary,
  EventRow,
  EventStage,
  ConfigNamespace,
  ConfigValue,
} from '@resume/contracts';

/** Thrown for any non-2xx response; carries the server's structured problems. */
export class ApiError extends Error {
  status: number;
  problems?: string[];
  constructor(message: string, status: number, problems?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problems = problems;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  const ct = res.headers.get('content-type') ?? '';
  const payload: unknown = ct.includes('application/json')
    ? await res.json().catch(() => undefined)
    : await res.text().catch(() => undefined);

  if (!res.ok) {
    const body = payload as
      | { error?: string; problems?: string[] }
      | string
      | undefined;
    const msg =
      (typeof body === 'object' && body?.error) ||
      (typeof body === 'string' && body) ||
      `HTTP ${res.status}`;
    const problems =
      typeof body === 'object' ? body?.problems : undefined;
    throw new ApiError(msg, res.status, problems);
  }
  return payload as T;
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const api = {
  // ---- jobs / review (§8) ----
  jobs: (status: JobStatus): Promise<JobListItem[]> =>
    request(`/api/jobs${qs({ status })}`),
  job: (id: string): Promise<JobDetail> =>
    request(`/api/jobs/${encodeURIComponent(id)}`),
  approve: (id: string): Promise<{ ok: true }> =>
    request(`/api/jobs/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  reject: (id: string, reason?: string): Promise<{ ok: true }> =>
    request(`/api/jobs/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      json: { reason },
    }),
  label: (id: string, label: 'good' | 'bad' | null): Promise<{ ok: true }> =>
    request(`/api/jobs/${encodeURIComponent(id)}/label`, {
      method: 'POST',
      json: { label },
    }),
  putOverlay: (id: string, overlay: Overlay): Promise<{ ok: true }> =>
    request(`/api/jobs/${encodeURIComponent(id)}/overlay`, {
      method: 'PUT',
      json: overlay,
    }),

  // ---- résumé (§8) ----
  resume: (): Promise<ResumeDoc> => request('/api/resume'),
  putResume: (
    doc: ResumeDoc
  ): Promise<{ ok: true; version: number; created_at: string }> =>
    request('/api/resume', { method: 'PUT', json: doc }),

  // ---- answers bank (§8) ----
  answers: (): Promise<Answer[]> => request('/api/answers'),
  putAnswer: (
    key: string,
    body: { question: string; answer: string }
  ): Promise<{ ok: true }> =>
    request(`/api/answers/${encodeURIComponent(key)}`, {
      method: 'PUT',
      json: body,
    }),
  addAnswer: (body: {
    question: string;
    answer: string;
  }): Promise<{ ok: true; key: string }> =>
    request('/api/answers', { method: 'POST', json: body }),
  deleteAnswer: (key: string): Promise<{ ok: true }> =>
    request(`/api/answers/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  // ---- config CRUD (§6/§8) ----
  config: <NS extends ConfigNamespace>(ns: NS): Promise<ConfigValue<NS>> =>
    request(`/api/config/${ns}`),
  putConfig: <NS extends ConfigNamespace>(
    ns: NS,
    value: ConfigValue<NS>
  ): Promise<{ ok: true; ns: string }> =>
    request(`/api/config/${ns}`, { method: 'PUT', json: value }),

  // ---- dashboard / events (§9) ----
  dashboardSummary: (): Promise<DashboardSummary> =>
    request('/api/dashboard/summary'),
  events: (opts?: {
    stage?: EventStage;
    ok?: boolean;
    job_id?: string;
    limit?: number;
    before?: number;
  }): Promise<EventRow[]> =>
    request(
      `/api/events${qs({
        stage: opts?.stage,
        ok: opts?.ok === undefined ? undefined : String(opts.ok),
        job_id: opts?.job_id,
        limit: opts?.limit,
        before: opts?.before,
      })}`
    ),
};

export type Api = typeof api;
