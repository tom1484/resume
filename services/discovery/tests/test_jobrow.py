"""§10 typed write: a finalized record validates to exactly the 13 contract
columns; an unexpected key or a bad type is a loud error (the anti-drop guard),
not a silent slice."""

import pytest

from discovery.jobrow import COLUMNS, ValidationError, validate_record


def good_record(**over):
    rec = {
        "id": "gh-acme-1",
        "source": "greenhouse",
        "company": "Acme",
        "title": "Robotics Intern",
        "location": "Remote",
        "remote": True,
        "url": "https://acme/jobs/1",
        "posted_at": "2026-06-09",
        "jd_text": "build robots",
        "status": "new",
        "skip_reason": None,
        "company_flags": ["dream"],
        "dedupe_key": "acme|robotics intern|remote",
    }
    rec.update(over)
    return rec


def test_columns_are_the_13_contract_fields():
    assert COLUMNS == [
        "id", "source", "company", "title", "location", "remote", "url",
        "posted_at", "jd_text", "status", "skip_reason", "company_flags", "dedupe_key",
    ]


def test_valid_record_passes_and_orders_columns():
    out = validate_record(good_record())
    assert list(out.keys()) == COLUMNS
    assert out["status"] == "new"
    assert out["company_flags"] == ["dream"]


def test_nullable_fields_accept_none():
    out = validate_record(good_record(location=None, remote=None, url=None, jd_text=None))
    assert out["location"] is None
    assert out["remote"] is None


def test_extra_key_is_rejected_not_silently_dropped():
    with pytest.raises(ValidationError):
        validate_record(good_record(extra_normalizer_field="unexpected value"))


def test_bad_status_rejected():
    with pytest.raises(ValidationError):
        validate_record(good_record(status="scored"))  # discovery only writes new|skipped


def test_bad_company_flag_rejected():
    with pytest.raises(ValidationError):
        validate_record(good_record(company_flags=["megacorp"]))
