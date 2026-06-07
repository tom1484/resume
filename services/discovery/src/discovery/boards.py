"""Fetchers for public job-board APIs (no auth, no scraping protection):

- Greenhouse: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
- Lever:      https://api.lever.co/v0/postings/{slug}?mode=json
- Ashby:      https://api.ashbyhq.com/posting-api/job-board/{slug}

Each fetcher returns a list of raw provider dicts; normalize.py turns them
into uniform job records.
"""

import html
import re

import httpx

TIMEOUT = httpx.Timeout(20.0)
UA = {"User-Agent": "job-pipeline/0.1 (personal job search tool)"}


def strip_html(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"<br\s*/?>|</p>|</li>|</div>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def fetch_greenhouse(slug: str) -> list[dict]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
    resp = httpx.get(url, timeout=TIMEOUT, headers=UA)
    resp.raise_for_status()
    return resp.json().get("jobs", [])


def fetch_lever(slug: str) -> list[dict]:
    url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
    resp = httpx.get(url, timeout=TIMEOUT, headers=UA)
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else []


def fetch_ashby(slug: str) -> list[dict]:
    url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true"
    resp = httpx.get(url, timeout=TIMEOUT, headers=UA)
    resp.raise_for_status()
    return resp.json().get("jobs", [])


FETCHERS = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
    "ashby": fetch_ashby,
}


def probe_slug(provider: str, slug: str) -> int | None:
    """Return posting count if the slug exists on the provider, else None."""
    try:
        return len(FETCHERS[provider](slug))
    except (httpx.HTTPStatusError, httpx.TransportError):
        return None
