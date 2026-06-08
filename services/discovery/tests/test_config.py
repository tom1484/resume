"""Best-effort DB config reader: a valid row merges over defaults; a missing row
or any DB error falls back to schema defaults. No live Postgres — the conn is a
fake cursor/connection."""

import pytest

from discovery.config import DISCOVERY_DEFAULT, get_config


class FakeCursor:
    def __init__(self, row):
        self._row = row

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, *a):
        pass

    def fetchone(self):
        return self._row


class FakeConn:
    def __init__(self, row):
        self._row = row

    def cursor(self):
        return FakeCursor(self._row)


class BrokenConn:
    def cursor(self):
        raise RuntimeError("no DB")


def test_empty_table_returns_defaults():
    cfg = get_config(FakeConn(None), "discovery")
    assert cfg == DISCOVERY_DEFAULT
    assert cfg["sites"] == ["indeed"]
    assert cfg["jobspyDefaults"]["location"] == "United States"


def test_db_error_returns_defaults():
    cfg = get_config(BrokenConn(), "schedule")
    assert cfg["discovery"]["cron"] == "0 9 * * *"
    assert cfg["discovery"]["tz"] == "Asia/Taipei"
    assert cfg["discovery"]["mode"] == "all"


def test_stored_row_merges_over_defaults():
    row = ({
        "searches": [{"name": "robotics", "term": "robotics intern", "enabled": True}],
        "sites": ["indeed", "linkedin"],
    },)
    cfg = get_config(FakeConn(row), "discovery")
    assert cfg["sites"] == ["indeed", "linkedin"]  # overridden
    assert len(cfg["searches"]) == 1
    # untouched keys keep their defaults
    assert cfg["titleInclude"] == DISCOVERY_DEFAULT["titleInclude"]
    assert cfg["jobspyDefaults"]["location"] == "United States"


def test_partial_nested_override_keeps_sibling_defaults():
    row = ({"jobspyDefaults": {"location": "California"}},)
    cfg = get_config(FakeConn(row), "discovery")
    assert cfg["jobspyDefaults"]["location"] == "California"
    assert cfg["jobspyDefaults"]["resultsWanted"] == 25  # default preserved


def test_unknown_namespace_raises():
    with pytest.raises(ValueError):
        get_config(FakeConn(None), "nope")
