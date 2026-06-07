"""JobSpy-based search for companies without public board APIs.

Conservative by design (report §6: home-IP bans are the #1 risk):
- Indeed only by default (no rate limit, JDs included in results);
  LinkedIn requires JOBSPY_SITES=indeed,linkedin (opt-in).
- One call per search term against a country-wide query, NOT per-location
  fan-out: 4 calls/night instead of 56.
- Jittered 3-10s pauses between calls.
"""

import os
import random
import sys
import time

from discovery.normalize import dedupe_key, finalize, is_internship, norm

INCLUDE_TERMS = ["intern", "internship", "co-op", "coop"]


def _sites() -> list[str]:
    return os.environ.get("JOBSPY_SITES", "indeed").split(",")


def _clean(value) -> str | None:
    """pandas rows carry NaN floats for missing strings — map them to None."""
    if value is None or (isinstance(value, float) and value != value):
        return None
    return str(value)


def _row_to_record(row: dict) -> dict:
    site = _clean(row.get("site")) or "jobspy"
    posted = _clean(row.get("date_posted"))
    return {
        "id": f"jobspy-{site}-{_clean(row.get('id'))}",
        "source": f"jobspy:{site}",
        "company": _clean(row.get("company")) or "Unknown",
        "title": _clean(row.get("title")) or "",
        "location": _clean(row.get("location")),
        "remote": bool(row.get("is_remote")) and row.get("is_remote") == row.get("is_remote"),
        "url": _clean(row.get("job_url")),
        "posted_at": posted[:10] if posted else None,
        "jd_text": _clean(row.get("description")),
    }


def run_searches(searches_cfg: dict) -> list[dict]:
    from jobspy import scrape_jobs  # heavy import (pandas), keep lazy

    defaults = searches_cfg["defaults"]
    exclude = searches_cfg["exclude"]
    flags_by_company = searches_cfg.get("_flags_by_company", {})
    records, seen_keys = [], set()

    for search in searches_cfg["searches"]:
        try:
            df = scrape_jobs(
                site_name=_sites(),
                search_term=search["term"],
                location="United States",
                results_wanted=defaults.get("results_wanted", 25),
                hours_old=defaults.get("hours_old", 72),
                job_type=defaults.get("job_type", "internship"),
                country_indeed=defaults.get("country", "USA"),
                description_format="markdown",
                verbose=0,
            )
        except Exception as err:  # one failed search must not kill the run
            print(f"  ! search '{search['name']}': {err}", file=sys.stderr)
            continue

        kept = 0
        for row in df.to_dict("records"):
            record = _row_to_record(row)
            if not is_internship(record["title"], INCLUDE_TERMS):
                continue
            key = dedupe_key(record["company"], record["title"], record["location"])
            if key in seen_keys:  # cross-search in-batch dedupe
                continue
            seen_keys.add(key)
            records.append(
                finalize(
                    record,
                    flags=flags_by_company.get(norm(record["company"]), []),
                    exclude_title=exclude["title"],
                    exclude_jd=exclude["jd"],
                )
            )
            kept += 1
        print(f"  search {search['name']:18s} {len(df):4d} results, {kept} internships kept")
        time.sleep(random.uniform(3, 10))
    return records
