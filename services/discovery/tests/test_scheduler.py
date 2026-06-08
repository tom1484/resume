"""Scheduler fire decision: honors enabled, cron+tz match, and same-minute
dedupe. No DB, no real time loop — _should_fire is pure given a config + a
last-fired key. We freeze 'now' by patching discovery.scheduler._now."""

import discovery.scheduler as sched


def cfg(cron="0 9 * * *", tz="Asia/Taipei", mode="all", enabled=True):
    return {"discovery": {"cron": cron, "tz": tz, "mode": mode, "enabled": enabled}}


def freeze(monkeypatch, dt):
    monkeypatch.setattr(sched, "_now", lambda _tz: dt)


def test_fires_when_cron_matches(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    freeze(monkeypatch, datetime(2026, 6, 9, 9, 0, tzinfo=ZoneInfo("Asia/Taipei")))
    fire, key = sched._should_fire(cfg(), None)
    assert fire is True
    assert key == "2026-06-09T09:00"


def test_does_not_fire_off_schedule(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    freeze(monkeypatch, datetime(2026, 6, 9, 10, 0, tzinfo=ZoneInfo("Asia/Taipei")))
    fire, _ = sched._should_fire(cfg(), None)
    assert fire is False


def test_disabled_never_fires(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    freeze(monkeypatch, datetime(2026, 6, 9, 9, 0, tzinfo=ZoneInfo("Asia/Taipei")))
    fire, _ = sched._should_fire(cfg(enabled=False), None)
    assert fire is False


def test_same_minute_dedupe(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    freeze(monkeypatch, datetime(2026, 6, 9, 9, 0, tzinfo=ZoneInfo("Asia/Taipei")))
    # already fired this minute → no re-fire
    fire, key = sched._should_fire(cfg(), "2026-06-09T09:00")
    assert fire is False
    assert key == "2026-06-09T09:00"


def test_invalid_cron_does_not_crash(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    freeze(monkeypatch, datetime(2026, 6, 9, 9, 0, tzinfo=ZoneInfo("Asia/Taipei")))
    fire, _ = sched._should_fire(cfg(cron="not a cron"), None)
    assert fire is False


def test_config_edit_takes_effect_next_tick(monkeypatch):
    """A UI cron edit changes the fire decision on the very next evaluation —
    proving the live, no-restart property at the decision level."""
    from datetime import datetime
    from zoneinfo import ZoneInfo

    freeze(monkeypatch, datetime(2026, 6, 9, 10, 0, tzinfo=ZoneInfo("Asia/Taipei")))
    assert sched._should_fire(cfg(cron="0 9 * * *"), None)[0] is False  # 09:00 only
    assert sched._should_fire(cfg(cron="0 10 * * *"), None)[0] is True  # edited to 10:00
