"""The standard 5-field cron matcher used by the in-process scheduler."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from discovery.cron import CronExpr


def at(y, mo, d, h, mi, tz="UTC"):
    return datetime(y, mo, d, h, mi, tzinfo=ZoneInfo(tz))


class TestCronExpr:
    def test_default_daily_9am(self):
        c = CronExpr("0 9 * * *")
        assert c.matches(at(2026, 6, 9, 9, 0))
        assert not c.matches(at(2026, 6, 9, 9, 1))
        assert not c.matches(at(2026, 6, 9, 8, 0))

    def test_every_minute(self):
        c = CronExpr("* * * * *")
        assert c.matches(at(2026, 1, 1, 0, 0))
        assert c.matches(at(2026, 12, 31, 23, 59))

    def test_step(self):
        c = CronExpr("*/15 * * * *")
        assert c.matches(at(2026, 6, 9, 10, 0))
        assert c.matches(at(2026, 6, 9, 10, 15))
        assert c.matches(at(2026, 6, 9, 10, 30))
        assert not c.matches(at(2026, 6, 9, 10, 7))

    def test_range_and_list(self):
        c = CronExpr("30 9-17 * * 1,5")  # 09:30-17:30 on Mon & Fri
        # 2026-06-08 is a Monday, 2026-06-12 is a Friday, 2026-06-09 is a Tuesday
        assert c.matches(at(2026, 6, 8, 14, 30))
        assert c.matches(at(2026, 6, 12, 14, 30))
        assert not c.matches(at(2026, 6, 9, 14, 30))  # Tuesday
        assert not c.matches(at(2026, 6, 8, 18, 30))  # past 17

    def test_sunday_is_0_or_7(self):
        # 2026-06-07 is a Sunday
        assert CronExpr("0 9 * * 0").matches(at(2026, 6, 7, 9, 0))
        assert CronExpr("0 9 * * 7").matches(at(2026, 6, 7, 9, 0))

    def test_invalid_field_count(self):
        with pytest.raises(ValueError):
            CronExpr("0 9 * *")
