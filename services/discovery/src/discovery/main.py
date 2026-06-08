"""Discovery entry point: fetch boards (+ optionally JobSpy), normalize, validate
against the DiscoveredJob contract, upsert into Postgres, log a discover event.

§10: config (sites, searches, companies, excludes, title-include) comes from the
DB-backed DiscoveryConfig (config table), NOT the YAMLs — those are migration seed
only, owned by the API agent. We just read config.

Usage (one-shot; the scheduler invokes run() in-process):
  python -m discovery.main --boards          # board APIs only
  python -m discovery.main --jobspy          # JobSpy searches only
  python -m discovery.main --all             # both
"""

import argparse
import sys
import time
from typing import Any, Literal

from discovery import store
from discovery.boards import FETCHERS
from discovery.config import get_config
from discovery.normalize import PROVIDER_NORMALIZERS, finalize, is_internship, norm

Mode = Literal["boards", "jobspy", "all"]


def run_boards(cfg: dict[str, Any]) -> list[dict]:
    exclude = cfg["exclude"]
    include_terms = cfg["titleInclude"]
    records = []
    for entry in cfg["companies"]:
        if not entry.get("enabled", True):
            continue
        board = entry.get("board")
        if not board:
            continue
        provider, slug = board["provider"], board["slug"]
        try:
            raw = FETCHERS[provider](slug)
        except Exception as err:
            print(f"  ! {entry['name']} ({provider}:{slug}): {err}", file=sys.stderr)
            continue
        normalizer = PROVIDER_NORMALIZERS[provider]
        kept = 0
        for job in raw:
            record = normalizer(job, entry["name"])
            if not is_internship(record["title"], include_terms):
                continue
            records.append(
                finalize(
                    record,
                    flags=entry.get("flags", []),
                    exclude_title=exclude["title"],
                    exclude_jd=exclude["jd"],
                )
            )
            kept += 1
        print(f"  {entry['name']:20s} {provider}:{slug:14s} {len(raw):4d} posts, {kept} interns")
        time.sleep(1)
    return records


def run_jobspy(cfg: dict[str, Any]) -> list[dict]:
    from discovery.jobspy_search import run_searches  # heavy import, lazy

    # JobSpy results matching a target company inherit its flags.
    flags_by_company = {
        norm(c["name"]): c.get("flags", []) for c in cfg["companies"]
    }
    return run_searches(cfg, flags_by_company)


def run(mode: Mode, *, conn=None, dry_run: bool = False) -> int:
    """Run a discovery pass. If `conn` is provided (the scheduler's long-lived
    connection), config is read from it and writes go through it; otherwise a
    fresh connection is opened for the write. Returns inserted count (or 0)."""
    do_boards = mode in ("boards", "all")
    do_jobspy = mode in ("jobspy", "all")

    owns_conn = conn is None
    if conn is None and not dry_run:
        conn = store.connect()
    # config read is best-effort; falls back to schema defaults without a conn.
    cfg = get_config(conn, "discovery") if conn is not None else get_config(_NoConn(), "discovery")

    started = time.monotonic()
    records: list[dict] = []
    if do_boards:
        print("== boards ==")
        records += run_boards(cfg)
    if do_jobspy:
        print("== jobspy ==")
        records += run_jobspy(cfg)

    fresh = sum(1 for r in records if r["status"] == "new")
    skipped = len(records) - fresh
    print(f"normalized: {len(records)} ({fresh} new, {skipped} skipped by rules)")

    if dry_run:
        return 0

    duration_ms = int((time.monotonic() - started) * 1000)
    inserted = store.upsert(conn, records)
    store.log_event(
        conn,
        "discover",
        ok=True,
        duration_ms=duration_ms,
        detail={
            "found": len(records),
            "inserted": inserted,
            "skipped_by_rules": skipped,
            "boards": do_boards,
            "jobspy": do_jobspy,
        },
    )
    if owns_conn:
        conn.close()
    print(f"inserted: {inserted} (deduped {len(records) - inserted})")
    return inserted


class _NoConn:
    """Sentinel so get_config(self) takes its except-path → schema defaults when
    discovery runs with no DB (--dry-run without DATABASE_URL)."""

    def cursor(self):
        raise RuntimeError("no DB connection")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--boards", action="store_true")
    parser.add_argument("--jobspy", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="fetch + normalize, no DB writes")
    args = parser.parse_args()
    do_boards = args.boards or args.all
    do_jobspy = args.jobspy or args.all
    if not (do_boards or do_jobspy):
        parser.error("pick --boards, --jobspy, or --all")
    mode: Mode = "all" if args.all else ("boards" if do_boards else "jobspy")
    run(mode, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
