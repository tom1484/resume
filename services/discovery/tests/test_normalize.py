"""Normalize contract: provider fixtures map to the uniform schema, and the
inclusion/exclusion rules word-match (the 'Internal != Intern' and
'year != EAR' regressions live here)."""

import json
from pathlib import Path

import pytest

from discovery.normalize import (
    dedupe_key,
    finalize,
    from_ashby,
    from_greenhouse,
    from_lever,
    is_internship,
    jd_skip_reason,
    title_skip_reason,
)

FIXTURES = Path(__file__).parent / "fixtures"
INCLUDE = ["intern", "internship", "co-op", "coop"]
EXCLUDE_TITLE = ["senior", "staff", "manager"]
EXCLUDE_JD = ["US citizenship", "security clearance", "ITAR", "EAR99", "export control"]

UNIFORM_KEYS = {
    "id",
    "source",
    "company",
    "title",
    "location",
    "remote",
    "url",
    "posted_at",
    "jd_text",
}


@pytest.mark.parametrize(
    ("fixture", "normalizer", "source"),
    [
        ("greenhouse_job.json", from_greenhouse, "greenhouse"),
        ("lever_posting.json", from_lever, "lever"),
        ("ashby_job.json", from_ashby, "ashby"),
    ],
)
def test_provider_normalizers(fixture, normalizer, source):
    raw = json.loads((FIXTURES / fixture).read_text())
    record = normalizer(raw, "Acme Robotics")
    assert set(record) == UNIFORM_KEYS
    assert record["source"] == source
    assert record["company"] == "Acme Robotics"
    assert record["id"].startswith(("gh-", "lever-", "ashby-"))
    assert record["title"]
    assert record["jd_text"] and "<" not in record["jd_text"][:200]


class TestInternshipFilter:
    def test_matches_intern_titles(self):
        assert is_internship("Software Engineering Intern", INCLUDE)
        assert is_internship("2027 Summer Internship - Robotics", INCLUDE)
        assert is_internship("Co-op, Controls", INCLUDE)

    def test_internal_and_international_do_not_match(self):
        assert not is_internship("Internal Communications Lead", INCLUDE)
        assert not is_internship("International Program Manager", INCLUDE)


class TestExcludes:
    def test_title_word_match(self):
        assert title_skip_reason("Senior Software Engineer", EXCLUDE_TITLE) == "title:senior"
        assert title_skip_reason("Software Intern", EXCLUDE_TITLE) is None

    def test_jd_whole_word(self):
        assert jd_skip_reason("requires an active security clearance", EXCLUDE_JD)
        assert jd_skip_reason("subject to ITAR regulations", EXCLUDE_JD)
        assert jd_skip_reason("we grew 3x this year and wear many hats", EXCLUDE_JD) is None

    def test_us_citizenship(self):
        assert jd_skip_reason("must hold US citizenship", ["US citizenship"]) == "jd:US citizenship"


def test_dedupe_key_normalization():
    a = dedupe_key("Figure", "Embedded Software Intern", "San Jose, CA")
    b = dedupe_key("FIGURE", "Embedded  Software   Intern!", "san jose ca")
    assert a == b


def test_finalize_sets_status_and_flags():
    record = {
        "id": "x",
        "source": "greenhouse",
        "company": "Acme",
        "title": "Robotics Intern",
        "location": "Remote",
        "remote": True,
        "url": "u",
        "posted_at": None,
        "jd_text": "build robots; requires ITAR authorization",
    }
    out = finalize(
        dict(record), flags=["dream"], exclude_title=EXCLUDE_TITLE, exclude_jd=EXCLUDE_JD
    )
    assert out["status"] == "skipped"
    assert out["skip_reason"] == "jd:ITAR"
    assert out["company_flags"] == ["dream"]
    record["jd_text"] = "build robots"
    out = finalize(dict(record), flags=[], exclude_title=EXCLUDE_TITLE, exclude_jd=EXCLUDE_JD)
    assert out["status"] == "new"
    assert out["skip_reason"] is None
