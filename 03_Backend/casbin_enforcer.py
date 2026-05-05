"""
Casbin RBAC enforcer — domain model backed by PostgreSQL.

Usage in routers:
    from casbin_enforcer import casbin_check

    @router.get("/protected", dependencies=[Depends(casbin_check("/api/reports/*", "GET"))])
    def protected_route(): ...

The enforcer is a module-level singleton; initialise via init_enforcer() at app startup.
Policy changes (role assignments) call enforcer.reload_policy() to pick up DB changes.
"""
import os
import logging
from pathlib import Path
from typing import Optional

import casbin
from casbin import Enforcer
from fastapi import Depends, HTTPException, Request, status

from auth_utils import require_auth
from database import query as _q

logger = logging.getLogger(__name__)

_enforcer: Optional[Enforcer] = None

_MODEL_PATH = str(Path(__file__).parent / "casbin" / "model.conf")

# ── PostgreSQL Adapter ────────────────────────────────────────────────────────

class PsycopgAdapter(casbin.persist.Adapter):
    """Casbin adapter backed by the existing PostgreSQL database via database.py."""

    def load_policy(self, model: casbin.Model) -> None:
        rows = _q(
            "SELECT ptype, v0, v1, v2, v3, v4, v5 FROM casbin_rule ORDER BY id",
            ()
        )
        for row in rows:
            values = [row.get(f"v{i}", "") or "" for i in range(6)]
            # Build policy line: "ptype, v0, v1, ..."  (strip trailing empty values)
            parts = [row["ptype"]] + [v for v in values if v]
            line = ", ".join(parts)
            casbin.persist.load_policy_line(line, model)

    def save_policy(self, model: casbin.Model) -> bool:
        # Not used — we manage policies individually via add/remove methods
        return True

    def add_policy(self, sec: str, ptype: str, rule: list) -> None:
        cols = ["ptype"] + [f"v{i}" for i in range(len(rule))]
        vals = [ptype] + list(rule)
        placeholders = ", ".join(["%s"] * len(vals))
        _q(
            f"INSERT INTO casbin_rule ({', '.join(cols)}) VALUES ({placeholders})",
            tuple(vals)
        )

    def remove_policy(self, sec: str, ptype: str, rule: list) -> None:
        conditions = " AND ".join([f"v{i} = %s" for i in range(len(rule))])
        _q(
            f"DELETE FROM casbin_rule WHERE ptype = %s AND {conditions}",
            tuple([ptype] + list(rule))
        )

    def remove_filtered_policy(self, sec: str, ptype: str, field_index: int, *field_values) -> None:
        conditions = [f"ptype = %s"]
        params = [ptype]
        for i, val in enumerate(field_values):
            if val:
                conditions.append(f"v{field_index + i} = %s")
                params.append(val)
        _q(f"DELETE FROM casbin_rule WHERE {' AND '.join(conditions)}", tuple(params))


# ── Seed helpers ──────────────────────────────────────────────────────────────

def _is_empty() -> bool:
    rows = _q("SELECT COUNT(*) AS cnt FROM casbin_rule", ())
    return not rows or int(rows[0]["cnt"]) == 0


def _seed_from_csv() -> None:
    seed_path = Path(__file__).parent / "casbin" / "policy_seed.csv"
    if not seed_path.exists():
        logger.warning("Casbin seed file not found: %s", seed_path)
        return

    with open(seed_path) as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) < 2:
                continue
            ptype = parts[0]
            values = parts[1:]
            cols = ["ptype"] + [f"v{i}" for i in range(len(values))]
            vals = [ptype] + values
            placeholders = ", ".join(["%s"] * len(vals))
            _q(
                f"INSERT INTO casbin_rule ({', '.join(cols)}) VALUES ({placeholders}) "
                f"ON CONFLICT DO NOTHING",
                tuple(vals)
            )
    logger.info("Casbin policies seeded from %s", seed_path)


# ── Enforcer lifecycle ────────────────────────────────────────────────────────

def init_enforcer() -> Enforcer:
    """Initialise the Casbin enforcer. Called once at app startup."""
    global _enforcer
    if _enforcer is not None:
        return _enforcer

    adapter = PsycopgAdapter()
    _enforcer = Enforcer(_MODEL_PATH, adapter)

    # Seed default policies if the table is empty
    if _is_empty():
        logger.info("casbin_rule table empty — seeding default policies")
        _seed_from_csv()
        _enforcer.load_policy()

    logger.info("Casbin enforcer initialised — %d policies loaded", len(_enforcer.get_policy()))
    return _enforcer


def get_enforcer() -> Enforcer:
    if _enforcer is None:
        raise RuntimeError("Casbin enforcer not initialised — call init_enforcer() at startup")
    return _enforcer


def reload_policy() -> None:
    """Reload all policies from DB. Call after any role assignment change."""
    if _enforcer:
        _enforcer.load_policy()
        logger.debug("Casbin policies reloaded")


# ── Role hierarchy helpers ────────────────────────────────────────────────────

ROLE_ORDER = ["viewer", "finance_user", "isource_admin", "ria_admin", "superadmin"]

def _role_level(role: str) -> int:
    try:
        return ROLE_ORDER.index(role)
    except ValueError:
        return -1


def is_higher_privilege(actor_role: str, target_role: str) -> bool:
    """Return True if actor has strictly higher privilege than target."""
    return _role_level(actor_role) > _role_level(target_role)


# ── FastAPI dependency factory ────────────────────────────────────────────────

def casbin_check(resource: str, action: str):
    """
    Dependency factory — enforces Casbin policy for a given resource + action.

    Usage:
        @router.get("/path", dependencies=[Depends(casbin_check("/api/reports/*", "GET"))])

    Falls back gracefully: if enforcer not ready, applies legacy role-based check.
    """
    async def _dep(
        current: dict = Depends(require_auth),
    ) -> dict:
        role   = current.get("role", "viewer")
        domain = current.get("tenant_id") or "*"

        # Superadmin bypasses all policy checks
        if role == "superadmin":
            return current

        enforcer = get_enforcer()
        allowed  = enforcer.enforce(role, domain, resource, action)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' is not permitted to {action} {resource}",
            )
        return current

    return _dep
