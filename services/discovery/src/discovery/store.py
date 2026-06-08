"""Postgres upsert for normalized job records + run-level event logging.

§10 typed write: each record is validated against the DiscoveredJob contract
(jobrow.py, mirror of @resume/contracts) BEFORE the SQL — a record that fails
validation is logged and skipped, never silently dict-sliced (the v1 drop bug).
"""

import json
import os
import sys

import psycopg

from discovery.jobrow import COLUMNS, ValidationError, validate_record

INSERT = f"""
INSERT INTO jobs ({", ".join(COLUMNS)})
VALUES ({", ".join(f"%({c})s" for c in COLUMNS)})
ON CONFLICT DO NOTHING
"""


def connect():
    return psycopg.connect(os.environ["DATABASE_URL"])


def upsert(conn, records: list[dict]) -> int:
    """Validate + insert records, skipping dedupe-key/id conflicts. Returns the
    inserted count. Records failing DiscoveredJob validation are logged+skipped
    (anti-drop §10: never silently lose a record to a column-slice)."""
    inserted = 0
    with conn.cursor() as cur:
        for record in records:
            try:
                row = validate_record(record)
            except ValidationError as err:
                print(
                    f"  ! dropping invalid record {record.get('id', '?')}: {err.errors()}",
                    file=sys.stderr,
                )
                continue
            cur.execute(INSERT, row)
            inserted += cur.rowcount
    conn.commit()
    return inserted


def log_event(conn, stage: str, *, ok: bool, duration_ms: int, detail: dict) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO events (stage, ok, duration_ms, detail) VALUES (%s, %s, %s, %s)",
            (stage, ok, duration_ms, json.dumps(detail)),
        )
    conn.commit()
