import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DashboardPage } from './DashboardPage';
import type { DashboardSummary, EventRow } from '@resume/contracts';

const summary: DashboardSummary = {
  costByStage: [
    { stage: 'parse_jd', costUsd: 0.12, calls: 4 },
    { stage: 'score', costUsd: 0.34, calls: 6 },
  ],
  costByModel: [{ model: 'claude-haiku-4-5', costUsd: 0.46 }],
  totalsByDay: [{ day: '2026-06-08', costUsd: 0.46 }],
  funnel: [
    { status: 'in_review', count: 3 },
    { status: 'scored', count: 5 },
  ],
  failures: [{ stage: 'verify_claims', count: 1 }],
};

const events: EventRow[] = [
  {
    id: 2,
    job_id: 'j1',
    stage: 'score',
    model: 'claude-haiku-4-5',
    input_tokens: 100,
    output_tokens: 50,
    cost_usd: 0.001,
    duration_ms: 1200,
    ok: true,
    detail: null,
    created_at: '2026-06-08T10:00:00+00:00',
  },
];

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const body = url.startsWith('/api/dashboard/summary') ? summary : events;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch
  );
}

describe('DashboardPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders cost totals, funnel and the events table from the API', async () => {
    mockApi();
    render(<DashboardPage />);

    // total spend = 0.12 + 0.34 = 0.46 (shown in the total card + the model bar)
    await waitFor(() =>
      expect(screen.getAllByText('$0.46').length).toBeGreaterThanOrEqual(1)
    );
    expect(screen.getByText('Total spend')).toBeInTheDocument();
    // stage + model breakdowns
    expect(screen.getByText('Cost by stage')).toBeInTheDocument();
    expect(screen.getByText('Cost by model')).toBeInTheDocument();
    expect(screen.getAllByText('claude-haiku-4-5').length).toBeGreaterThanOrEqual(
      1
    );
    // funnel statuses
    expect(screen.getByText('in_review')).toBeInTheDocument();
    // failures rollup
    expect(screen.getByText('verify_claims: 1')).toBeInTheDocument();
    // events table populated
    await waitFor(() =>
      expect(screen.getByText('Recent events')).toBeInTheDocument()
    );
    expect(screen.getByText('1200')).toBeInTheDocument();
  });
});
