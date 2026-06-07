"""Discovery entry point: fetch boards (+ optionally JobSpy), normalize,
upsert into Postgres, log a discover event.

Usage:
  python -m discovery.main --boards          # board APIs only
  python -m discovery.main --jobspy          # JobSpy searches only
  python -m discovery.main --all             # both (nightly cron default)
"""

import argparse
import os
import sys
import time
from pathlib import Path

import yaml

from discovery import store
from discovery.boards import FETCHERS
from discovery.normalize import PROVIDER_NORMALIZERS, finalize, is_internship

CONFIG_DIR = Path(os.environ.get("CONFIG_DIR", Path(__file__).parents[2] / "config"))


def load_config():
    searches = yaml.safe_load((CONFIG_DIR / "searches.yml").read_text())
    companies = yaml.safe_load((CONFIG_DIR / "companies.yml").read_text())
    return searches, companies


def run_boards(searches_cfg: dict, companies_cfg: dict) -> list[dict]:
    exclude = searches_cfg["exclude"]
    include_terms = companies_cfg["title_include"]
    records = []
    for entry in companies_cfg["companies"]:
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


def run_jobspy(searches_cfg: dict, companies_cfg: dict) -> list[dict]:
    from discovery.jobspy_search import run_searches  # heavy import, lazy
    from discovery.normalize import norm

    # JobSpy results matching a target company inherit its flags
    searches_cfg["_flags_by_company"] = {
        norm(c["name"]): c.get("flags", []) for c in companies_cfg["companies"]
    }
    return run_searches(searches_cfg)


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

    searches_cfg, companies_cfg = load_config()
    started = time.monotonic()
    records = []
    if do_boards:
        print("== boards ==")
        records += run_boards(searches_cfg, companies_cfg)
    if do_jobspy:
        print("== jobspy ==")
        records += run_jobspy(searches_cfg, companies_cfg)

    fresh = sum(1 for r in records if r["status"] == "new")
    skipped = len(records) - fresh
    print(f"normalized: {len(records)} ({fresh} new, {skipped} skipped by rules)")

    if args.dry_run:
        return 0

    duration_ms = int((time.monotonic() - started) * 1000)
    with store.connect() as conn:
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
    print(f"inserted: {inserted} (deduped {len(records) - inserted})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
