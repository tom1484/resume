"""Minimal standard 5-field cron matcher (no external dependency).

Fields: minute hour day-of-month month day-of-week.
Supports: `*`, single ints, `a-b` ranges, `a,b,c` lists, and `*/n` / `a-b/n`
steps. Day-of-week: 0 or 7 = Sunday. A datetime matches when every field matches
(dom/dow use cron's standard OR semantics only when BOTH are restricted; here we
match if dom matches AND dow matches, which is sufficient for the default
`0 9 * * *` and the common UI cases — documented limitation vs full Vixie cron).
"""

from __future__ import annotations

from datetime import datetime


def _parse_field(spec: str, lo: int, hi: int) -> set[int]:
    values: set[int] = set()
    for part in spec.split(","):
        step = 1
        if "/" in part:
            part, step_s = part.split("/", 1)
            step = int(step_s)
        if part == "*":
            start, end = lo, hi
        elif "-" in part:
            a, b = part.split("-", 1)
            start, end = int(a), int(b)
        else:
            start = end = int(part)
        for v in range(start, end + 1, step):
            values.add(v)
    return values


class CronExpr:
    def __init__(self, expr: str):
        fields = expr.split()
        if len(fields) != 5:
            raise ValueError(f"cron must have 5 fields, got {len(fields)}: {expr!r}")
        self.minute = _parse_field(fields[0], 0, 59)
        self.hour = _parse_field(fields[1], 0, 23)
        self.dom = _parse_field(fields[2], 1, 31)
        self.month = _parse_field(fields[3], 1, 12)
        # normalize 7 -> 0 (Sunday) in day-of-week
        self.dow = {0 if d == 7 else d for d in _parse_field(fields[4], 0, 7)}

    def matches(self, dt: datetime) -> bool:
        # python weekday(): Mon=0..Sun=6; cron dow: Sun=0..Sat=6
        cron_dow = (dt.weekday() + 1) % 7
        return (
            dt.minute in self.minute
            and dt.hour in self.hour
            and dt.day in self.dom
            and dt.month in self.month
            and cron_dow in self.dow
        )
