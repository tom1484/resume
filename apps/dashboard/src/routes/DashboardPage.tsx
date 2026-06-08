import { useCallback } from 'react';
import { api } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { fmtUsd } from '@/lib/utils';
import { AsyncBoundary } from '@/components/AsyncBoundary';
import { PageHeader } from '@/components/PageHeader';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { DashboardSummary, EventRow } from '@resume/contracts';

// Simple horizontal bar (no chart lib — keeps the bundle lean; "simple charts").
function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{fmtUsd(value)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SummaryView({ s }: { s: DashboardSummary }) {
  const total = s.costByStage.reduce((a, b) => a + b.costUsd, 0);
  const totalCalls = s.costByStage.reduce((a, b) => a + b.calls, 0);
  const totalJobs = s.funnel.reduce((a, b) => a + b.count, 0);
  const totalFailures = s.failures.reduce((a, b) => a + b.count, 0);
  const maxStage = Math.max(0, ...s.costByStage.map((x) => x.costUsd));
  const maxModel = Math.max(0, ...s.costByModel.map((x) => x.costUsd));
  const maxDay = Math.max(0, ...s.totalsByDay.map((x) => x.costUsd));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Total spend
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {fmtUsd(total)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              LLM calls
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{totalCalls}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Jobs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{totalJobs}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Failures
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-destructive">
            {totalFailures}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost by stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.costByStage.length === 0 && (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            )}
            {s.costByStage.map((x) => (
              <Bar
                key={x.stage}
                label={`${x.stage} (${x.calls})`}
                value={x.costUsd}
                max={maxStage}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost by model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.costByModel.length === 0 && (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            )}
            {s.costByModel.map((x) => (
              <Bar
                key={x.model}
                label={x.model}
                value={x.costUsd}
                max={maxModel}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily spend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {s.totalsByDay.length === 0 && (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            )}
            {s.totalsByDay.map((x) => (
              <Bar key={x.day} label={x.day} value={x.costUsd} max={maxDay} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.funnel.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
                      No jobs yet.
                    </TableCell>
                  </TableRow>
                )}
                {s.funnel.map((x) => (
                  <TableRow key={x.status}>
                    <TableCell>
                      <Badge variant="secondary">{x.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {x.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {s.failures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Failures by stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {s.failures.map((f) => (
                <Badge key={f.stage} variant="destructive">
                  {f.stage}: {f.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EventsTable({ rows }: { rows: EventRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent events</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">In</TableHead>
              <TableHead className="text-right">Out</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">ms</TableHead>
              <TableHead>OK</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  No events.
                </TableCell>
              </TableRow>
            )}
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap font-mono text-xs">
                  {e.created_at.replace('T', ' ').slice(0, 19)}
                </TableCell>
                <TableCell>{e.stage}</TableCell>
                <TableCell className="text-xs">{e.model ?? '—'}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {e.input_tokens ?? '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {e.output_tokens ?? '—'}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {fmtUsd(e.cost_usd)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {e.duration_ms ?? '—'}
                </TableCell>
                <TableCell>
                  {e.ok ? (
                    <Badge variant="success">ok</Badge>
                  ) : (
                    <Badge variant="destructive">fail</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const summary = useAsync(() => api.dashboardSummary(), []);
  const events = useAsync(() => api.events({ limit: 50 }), []);
  const retry = useCallback(() => {
    summary.reload();
    events.reload();
  }, [summary, events]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Cost ledger, status funnel and recent pipeline events."
      />
      <div className="space-y-6">
        <AsyncBoundary
          loading={summary.loading}
          error={summary.error}
          data={summary.data}
          onRetry={retry}
        >
          {(s) => <SummaryView s={s} />}
        </AsyncBoundary>
        <AsyncBoundary
          loading={events.loading}
          error={events.error}
          data={events.data}
          onRetry={retry}
        >
          {(rows) => <EventsTable rows={rows} />}
        </AsyncBoundary>
      </div>
    </div>
  );
}
