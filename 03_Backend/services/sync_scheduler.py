"""
services/sync_scheduler.py — Configurable Sync Scheduler
Agent: Rohan_Backend_003  |  Ticket: IC-14 / ERP-SP-001
Cron-expression based scheduling stored in dim_erp_source.sync_schedule.
Uses croniter for cron evaluation. No APScheduler dependency — just decision logic.
"""
from __future__ import annotations
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, List, Optional

logger = logging.getLogger(__name__)

_SAVE_SCHEDULE_SQL = """
    UPDATE dim_erp_source
    SET sync_schedule = %s,
        is_active     = %s,
        updated_at    = NOW()
    WHERE erp_source_id = %s
      AND tenant_id     = %s
"""

_GET_SCHEDULES_SQL = """
    SELECT erp_source_id, sync_schedule, tenant_id
    FROM dim_erp_source
    WHERE is_active = TRUE
      AND sync_schedule IS NOT NULL
"""


@dataclass
class ScheduleConfig:
    erp_source_id: int
    cron_expression: str
    is_enabled: bool
    tenant_id: uuid.UUID


class SyncSchedulerService:
    """
    Manages sync schedule configuration and cron-based due-time evaluation.

    Usage:
        svc = SyncSchedulerService(db_query=database.query)
        schedules = svc.get_enabled_schedules()
        for sc in schedules:
            if svc.is_due(sc.cron_expression):
                trigger_sync(sc.erp_source_id)
    """

    def __init__(self, db_query: Optional[Callable]):
        self._query = db_query

    def save_schedule(self, config: ScheduleConfig) -> None:
        """Persist cron schedule to dim_erp_source."""
        self._query(_SAVE_SCHEDULE_SQL, (
            config.cron_expression,
            config.is_enabled,
            config.erp_source_id,
            str(config.tenant_id),
        ))

    def get_enabled_schedules(self) -> List[ScheduleConfig]:
        """Return all active ERP sources with a schedule."""
        rows = self._query(_GET_SCHEDULES_SQL, ())
        return [
            ScheduleConfig(
                erp_source_id=r["erp_source_id"],
                cron_expression=r["sync_schedule"],
                is_enabled=True,
                tenant_id=uuid.UUID(str(r["tenant_id"])),
            )
            for r in rows
        ]

    def is_due(self, cron_expression: str, at: Optional[datetime] = None) -> bool:
        """Return True if cron expression is due at the given datetime (default: now)."""
        try:
            from croniter import croniter, CroniterBadCronError
        except ImportError:
            raise RuntimeError("croniter not installed. pip install croniter")

        check_time = at or datetime.now()
        # Validate cron expression first
        try:
            croniter.expand(cron_expression)
        except Exception:
            raise ValueError(f"Invalid cron expression: {cron_expression!r}")

        # A cron is "due" if the most recent occurrence falls within check_time's minute.
        # Start croniter one minute before so get_next() lands on check_time's minute if due.
        from datetime import timedelta
        start = check_time - timedelta(minutes=1)
        try:
            cron = croniter(cron_expression, start)
        except Exception:
            raise ValueError(f"Invalid cron expression: {cron_expression!r}")

        nxt = cron.get_next(datetime)
        return (
            nxt.year == check_time.year and
            nxt.month == check_time.month and
            nxt.day == check_time.day and
            nxt.hour == check_time.hour and
            nxt.minute == check_time.minute
        )
