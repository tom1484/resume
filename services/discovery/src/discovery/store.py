"""Postgres upsert for normalized job records + run-level event logging."""

import json
import os

import psycopg

COLUMNS = [
    "id",
    "source",
    "company",
    "title",
    "location",
    "remote",
    "url",
    "posted_at",
    "jd_text",
    "status",
    "skip_reason",
    "company_flags",
    "dedupe_key",
]

INSERT = f"""
INSERT INTO jobs ({", ".join(COLUMNS)})
VALUES ({", ".join(f"%({c})s" for c in COLUMNS)})
ON CONFLICT DO NOTHING
"""


def connect():
    return psycopg.connect(os.environ["DATABASE_URL"])


def upsert(conn, records: list[dict]) -> int:
    """Insert records, skipping any dedupe-key or id conflict. Returns inserted count."""
    inserted = 0
    with conn.cursor() as cur:
        for record in records:
            row = {c: record.get(c) for c in COLUMNS}
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
