"""Best-effort DB-backed config reader (§6) for the discovery service.

Mirrors the @resume/contracts Zod config schemas (DiscoveryConfig, ScheduleConfig)
in lockstep — Python can't import the TS Zod, so the defaults below MUST track
packages/contracts/src/config.ts. Reads one row per namespace from the `config`
table ({ns text PK, value jsonb}); on ANY failure (no DB, missing row, malformed
value) returns the schema default merged over whatever the row provided — a
best-effort resilience pattern, never crash a run.

searches/companies/sites/excludes (§10) all come from the DB-backed config.
"""

from __future__ import annotations

import sys
from typing import Any

# --- Schema defaults (lockstep with contracts/config.ts) ---

DISCOVERY_DEFAULT: dict[str, Any] = {
    "sites": ["indeed"],
    "jobspyDefaults": {
        "resultsWanted": 25,
        "hoursOld": 72,
        "jobType": "internship",
        "country": "USA",
        "location": "United States",
    },
    "titleInclude": ["intern", "internship", "co-op", "coop"],
    "exclude": {
        "title": ["senior", "staff", "principal", "manager", "director", "phd"],
        "jd": [
            "US citizenship",
            "US citizen",
            "security clearance",
            "ITAR",
            "EAR99",
            "export control",
            "unpaid",
        ],
    },
    "searches": [],
    "companies": [],
}

SCHEDULE_DEFAULT: dict[str, Any] = {
    "discovery": {
        "enabled": True,
        "cron": "0 9 * * *",
        "tz": "Asia/Taipei",
        "mode": "all",
    },
}

_DEFAULTS = {"discovery": DISCOVERY_DEFAULT, "schedule": SCHEDULE_DEFAULT}


def _deep_merge(default: Any, override: Any) -> Any:
    """Shallow-recursive merge: override wins per key; missing keys fall back to
    default. Lists/scalars in override replace the default outright (matches Zod
    object defaulting on a per-field basis)."""
    if isinstance(default, dict) and isinstance(override, dict):
        out = dict(default)
        for k, v in override.items():
            out[k] = _deep_merge(default.get(k), v) if k in default else v
        return out
    return override if override is not None else default


def get_config(conn, ns: str) -> dict[str, Any]:
    """Read+merge config namespace `ns`. Best-effort: any error → schema default."""
    default = _DEFAULTS.get(ns)
    if default is None:
        raise ValueError(f"unknown config namespace: {ns}")
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM config WHERE ns = %s LIMIT 1", (ns,))
            row = cur.fetchone()
        if row and isinstance(row[0], dict):
            return _deep_merge(default, row[0])
    except Exception as err:  # best-effort, never crash a run
        print(f"  ! config[{ns}] read failed, using defaults: {err}", file=sys.stderr)
    return dict(default)
