// §9 dashboard read side: roll up the `events` cost ledger + the jobs status
// funnel into a DashboardSummary. This is the read API over the `events` table.
import {
  DashboardSummary,
  EventStage,
  type DashboardSummary as DashboardSummaryT,
} from '@resume/contracts';
import type { Queryable } from './pool.js';

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const str = (v: unknown): string => (v == null ? '' : String(v));

/** Build the dashboard summary from the events + jobs tables. */
export async function dashboardSummary(
  db: Queryable
): Promise<DashboardSummaryT> {
  const validStages = new Set(EventStage.options as readonly string[]);
  const keepStage = (r: Record<string, unknown>): boolean =>
    validStages.has(str(r.stage));

  const [byStage, byModel, byDay, funnel, failures] = await Promise.all([
    db.query(
      `SELECT stage, COALESCE(SUM(cost_usd),0) AS cost, COUNT(*) AS calls
         FROM events GROUP BY stage`
    ),
    db.query(
      `SELECT model, COALESCE(SUM(cost_usd),0) AS cost
         FROM events WHERE model IS NOT NULL GROUP BY model`
    ),
    db.query(
      `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day,
              COALESCE(SUM(cost_usd),0) AS cost
         FROM events GROUP BY day ORDER BY day`
    ),
    db.query(`SELECT status, COUNT(*) AS count FROM jobs GROUP BY status`),
    db.query(
      `SELECT stage, COUNT(*) AS count
         FROM events WHERE ok = false GROUP BY stage`
    ),
  ]);

  const summary: DashboardSummaryT = {
    costByStage: byStage.rows.filter(keepStage).map((r) => ({
      stage: str(r.stage) as DashboardSummaryT['costByStage'][number]['stage'],
      costUsd: num(r.cost),
      calls: num(r.calls),
    })),
    costByModel: byModel.rows.map((r) => ({
      model: str(r.model),
      costUsd: num(r.cost),
    })),
    totalsByDay: byDay.rows.map((r) => ({
      day: str(r.day),
      costUsd: num(r.cost),
    })),
    funnel: funnel.rows.map((r) => ({
      status: str(r.status),
      count: num(r.count),
    })),
    failures: failures.rows.filter(keepStage).map((r) => ({
      stage: str(r.stage) as DashboardSummaryT['failures'][number]['stage'],
      count: num(r.count),
    })),
  };

  // Re-validate the assembled DTO against the contract before returning.
  return DashboardSummary.parse(summary);
}
