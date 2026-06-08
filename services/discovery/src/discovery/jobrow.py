"""Typed discovery → jobs-row contract (§10), the Python mirror of
@resume/contracts `DiscoveredJob` (jobRow.ts). Kept in LOCKSTEP with the Zod
shape. Each record is validated against this BEFORE upsert, killing the v1 silent
dict-slice drop (store.py:39 `row = {c: record.get(c) for c in COLUMNS}` dropped
any normalizer key not in COLUMNS without warning).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, ValidationError

CompanyFlag = Literal["dream", "startup", "return-path"]


class DiscoveredJob(BaseModel):
    """Exactly the 13 store.COLUMNS, now typed (matches DiscoveredJob in
    jobRow.ts). `extra='forbid'` is the anti-drop guard: an unexpected key is a
    loud validation error, not a silent drop."""

    model_config = ConfigDict(extra="forbid")

    id: str
    source: str
    company: str
    title: str
    location: str | None
    remote: bool | None
    url: str | None
    posted_at: str | None  # ISO date
    jd_text: str | None
    status: Literal["new", "skipped"]
    skip_reason: str | None
    company_flags: list[CompanyFlag]
    dedupe_key: str


# The DB column order (the INSERT column list). Kept here as the single ordering
# source so store.py builds the row in a stable order.
COLUMNS = list(DiscoveredJob.model_fields.keys())


def validate_record(record: dict) -> dict:
    """Validate a finalized record against DiscoveredJob; returns a clean dict in
    COLUMNS order. Raises ValidationError on any mismatch (caller logs+skips)."""
    job = DiscoveredJob.model_validate(record)
    return {c: getattr(job, c) for c in COLUMNS}


__all__ = ["COLUMNS", "DiscoveredJob", "ValidationError", "validate_record"]
