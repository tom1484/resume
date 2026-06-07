"""Normalize provider records into the uniform job schema (PROPOSALS.md §3.2)
and apply title/JD exclusion rules (F-1 constraints, seniority, etc.)."""

import re
from datetime import UTC, datetime

from discovery.boards import strip_html


def norm(s: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def dedupe_key(company: str, title: str, location: str | None) -> str:
    return "|".join([norm(company), norm(title), norm(location)])


def is_internship(title: str, include_terms: list[str]) -> bool:
    """Whole-word match: 'intern' must NOT match 'internal'/'international'."""
    t = norm(title)
    return any(re.search(rf"\b{re.escape(norm(term))}\b", t) for term in include_terms)


def title_skip_reason(title: str, exclude_title: list[str]) -> str | None:
    t = norm(title)
    for term in exclude_title:
        if norm(term) in t.split():
            return f"title:{term}"
    return None


def jd_skip_reason(jd_text: str | None, exclude_jd: list[str]) -> str | None:
    """Whole-word phrase match: 'EAR' must NOT match 'year'/'wear'."""
    if not jd_text:
        return None
    for term in exclude_jd:
        if re.search(rf"\b{re.escape(term.strip())}\b", jd_text, flags=re.IGNORECASE):
            return f"jd:{term.strip()}"
    return None


def _date(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):  # epoch millis (Lever)
        return datetime.fromtimestamp(value / 1000, tz=UTC).date().isoformat()
    return str(value)[:10]


def from_greenhouse(job: dict, company: str) -> dict:
    return {
        "id": f"gh-{norm(company).replace(' ', '-')}-{job['id']}",
        "source": "greenhouse",
        "company": company,
        "title": job.get("title", ""),
        "location": (job.get("location") or {}).get("name"),
        "remote": "remote" in norm((job.get("location") or {}).get("name")),
        "url": job.get("absolute_url"),
        "posted_at": _date(job.get("updated_at")),
        "jd_text": strip_html(job.get("content", "")),
    }


def from_lever(posting: dict, company: str) -> dict:
    cats = posting.get("categories") or {}
    location = cats.get("location")
    return {
        "id": f"lever-{norm(company).replace(' ', '-')}-{posting['id']}",
        "source": "lever",
        "company": company,
        "title": posting.get("text", ""),
        "location": location,
        "remote": "remote" in norm(location) or posting.get("workplaceType") == "remote",
        "url": posting.get("hostedUrl"),
        "posted_at": _date(posting.get("createdAt")),
        "jd_text": posting.get("descriptionPlain") or strip_html(posting.get("description", "")),
    }


def from_ashby(job: dict, company: str) -> dict:
    return {
        "id": f"ashby-{norm(company).replace(' ', '-')}-"
        f"{job.get('id') or norm(job.get('title', ''))}",
        "source": "ashby",
        "company": company,
        "title": job.get("title", ""),
        "location": job.get("location"),
        "remote": bool(job.get("isRemote")),
        "url": job.get("jobUrl") or job.get("applyUrl"),
        "posted_at": _date(job.get("publishedAt")),
        "jd_text": job.get("descriptionPlain") or strip_html(job.get("descriptionHtml", "")),
    }


PROVIDER_NORMALIZERS = {
    "greenhouse": from_greenhouse,
    "lever": from_lever,
    "ashby": from_ashby,
}


def finalize(
    record: dict, *, flags: list[str], exclude_title: list[str], exclude_jd: list[str]
) -> dict:
    """Attach flags, dedupe key, and skip status to a normalized record."""
    record["company_flags"] = flags
    record["dedupe_key"] = dedupe_key(record["company"], record["title"], record["location"])
    reason = title_skip_reason(record["title"], exclude_title) or jd_skip_reason(
        record["jd_text"], exclude_jd
    )
    record["status"] = "skipped" if reason else "new"
    record["skip_reason"] = reason
    return record
