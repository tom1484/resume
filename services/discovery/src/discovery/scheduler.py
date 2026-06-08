"""In-process, DB-driven scheduler (DECISIONS req 6) — replaces supercronic.

A long-running process that ticks once a minute. EACH tick it re-reads
ScheduleConfig from the `config` table (best-effort, schema-default fallback), so
a UI edit to the cron / tz / mode / enabled flag takes effect on the NEXT tick
with NO restart. When the configured cron matches the current minute (evaluated
in the configured tz) and discovery is enabled, it triggers an in-process
discovery run for the configured mode.

Why per-minute polling rather than sleeping until the next cron time: the config
is live, so the next fire time can change between ticks; re-reading every minute
is the simplest correct way to honor "effect next tick, no restart".
"""

from __future__ import annotations

import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from discovery import store
from discovery.config import get_config
from discovery.cron import CronExpr
from discovery.main import run

TICK_SECONDS = 60


def _now(tz: str) -> datetime:
    try:
        return datetime.now(ZoneInfo(tz))
    except Exception:  # bad tz from UI → fall back to UTC, never crash
        print(f"  ! invalid tz {tz!r}, using UTC", file=sys.stderr)
        return datetime.now(ZoneInfo("UTC"))


def _should_fire(cfg: dict, last_fired_minute: str | None) -> tuple[bool, str | None]:
    """Return (fire?, minute_key). minute_key dedupes within the same clock
    minute so a run never double-fires if a tick is slightly fast."""
    d = cfg["discovery"]
    if not d.get("enabled", True):
        return False, last_fired_minute
    now = _now(d["tz"])
    minute_key = now.strftime("%Y-%m-%dT%H:%M")
    if minute_key == last_fired_minute:
        return False, last_fired_minute
    try:
        cron = CronExpr(d["cron"])
    except ValueError as err:
        print(f"  ! invalid cron {d['cron']!r}: {err}", file=sys.stderr)
        return False, last_fired_minute
    return (cron.matches(now), minute_key)


def loop(*, ticks: int | None = None) -> None:
    """Run the scheduler loop. `ticks=None` runs forever; a finite count is for
    tests. Holds one long-lived DB connection for config reads + run writes."""
    conn = store.connect()
    last_fired_minute: str | None = None
    print("discovery scheduler up (DB-driven, per-minute tick)")
    count = 0
    while ticks is None or count < ticks:
        cfg = get_config(conn, "schedule")
        fire, minute_key = _should_fire(cfg, last_fired_minute)
        if fire:
            mode = cfg["discovery"]["mode"]
            print(f"== scheduled discovery run (mode={mode}) at {minute_key} ==")
            last_fired_minute = minute_key
            try:
                run(mode, conn=conn)
            except Exception as err:  # a failed run must not kill the scheduler
                print(f"  ! discovery run failed: {err}", file=sys.stderr)
        count += 1
        if ticks is None or count < ticks:
            time.sleep(TICK_SECONDS)
    conn.close()


def main() -> int:
    loop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
