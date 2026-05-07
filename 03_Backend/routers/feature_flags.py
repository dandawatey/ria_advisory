"""
Feature Flags API

Global (defaults):
  GET  /api/feature-flags          → list global defaults (authenticated)
  GET  /api/feature-flags/public   → list global defaults (no auth)
  PUT  /api/feature-flags/{key}    → update global default (superadmin only)

Per-tenant (overrides global defaults):
  GET  /api/tenants/{tid}/feature-flags          → merged flags for tenant
  PUT  /api/tenants/{tid}/feature-flags/{key}    → upsert tenant override (superadmin only)
  POST /api/tenants/{tid}/feature-flags/reset    → reset to Phase 1 defaults
  POST /api/tenants/{tid}/feature-flags/enable-all → enable all flags for tenant
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth_utils import require_auth, require_role
from database import get_conn

router = APIRouter(tags=["feature-flags"])


class FeatureFlag(BaseModel):
    flag_key:    str
    label:       str
    description: Optional[str]
    is_enabled:  bool
    phase:       str
    category:    str


class FlagUpdate(BaseModel):
    is_enabled: bool


# ── Global defaults ───────────────────────────────────────────────────────────

@router.get("/api/feature-flags", response_model=List[FeatureFlag])
def list_flags(_: dict = Depends(require_auth)):
    return _fetch_global()


@router.get("/api/feature-flags/public", response_model=List[FeatureFlag])
def list_flags_public():
    """No auth — used by frontend before auth loads."""
    return _fetch_global()


@router.put("/api/feature-flags/{flag_key}")
def update_global_flag(
    flag_key: str,
    body: FlagUpdate,
    _: dict = Depends(require_role("superadmin", "isource_admin")),
):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE feature_flags SET is_enabled = %s, updated_at = NOW() WHERE flag_key = %s",
                (body.is_enabled, flag_key),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail=f"Flag '{flag_key}' not found")
        conn.commit()
        return {"flag_key": flag_key, "is_enabled": body.is_enabled}
    finally:
        conn.close()


# ── Per-tenant endpoints ──────────────────────────────────────────────────────

@router.get("/api/tenants/{tenant_id}/feature-flags", response_model=List[FeatureFlag])
def list_tenant_flags(
    tenant_id: str,
    current: dict = Depends(require_auth),
):
    _assert_tenant_access(current, tenant_id)
    return _fetch_merged(tenant_id)


@router.put("/api/tenants/{tenant_id}/feature-flags/{flag_key}")
def update_tenant_flag(
    tenant_id: str,
    flag_key: str,
    body: FlagUpdate,
    current: dict = Depends(require_role("superadmin", "isource_admin")),
):
    _assert_tenant_access(current, tenant_id)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Verify flag exists
            cur.execute("SELECT 1 FROM feature_flags WHERE flag_key = %s", (flag_key,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail=f"Flag '{flag_key}' not found")
            # Upsert tenant override
            cur.execute("""
                INSERT INTO tenant_feature_flags (tenant_id, flag_key, is_enabled, updated_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (tenant_id, flag_key)
                DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW()
            """, (tenant_id, flag_key, body.is_enabled))
        conn.commit()
        return {"tenant_id": tenant_id, "flag_key": flag_key, "is_enabled": body.is_enabled}
    finally:
        conn.close()


@router.post("/api/tenants/{tenant_id}/feature-flags/reset")
def reset_tenant_flags_to_phase1(
    tenant_id: str,
    current: dict = Depends(require_role("superadmin", "isource_admin")),
):
    """Delete all tenant overrides — tenant falls back to global Phase 1 defaults."""
    _assert_tenant_access(current, tenant_id)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM tenant_feature_flags WHERE tenant_id = %s", (tenant_id,))
        conn.commit()
        return {"tenant_id": tenant_id, "reset": "phase1_defaults"}
    finally:
        conn.close()


@router.post("/api/tenants/{tenant_id}/feature-flags/enable-all")
def enable_all_tenant_flags(
    tenant_id: str,
    current: dict = Depends(require_role("superadmin", "isource_admin")),
):
    """Enable every flag for this tenant (i-Source / superadmin use)."""
    _assert_tenant_access(current, tenant_id)
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO tenant_feature_flags (tenant_id, flag_key, is_enabled, updated_at)
                SELECT %s, flag_key, true, NOW()
                FROM feature_flags
                ON CONFLICT (tenant_id, flag_key)
                DO UPDATE SET is_enabled = true, updated_at = NOW()
            """, (tenant_id,))
        conn.commit()
        return {"tenant_id": tenant_id, "enabled": "all"}
    finally:
        conn.close()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fetch_global() -> List[FeatureFlag]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT flag_key, label, description, is_enabled, phase, category
                FROM feature_flags
                ORDER BY phase, category, label
            """)
            return [_row_to_flag(r) for r in cur.fetchall()]
    finally:
        conn.close()


def _fetch_merged(tenant_id: str) -> List[FeatureFlag]:
    """Return global defaults overridden by any tenant-specific rows."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    f.flag_key,
                    f.label,
                    f.description,
                    COALESCE(t.is_enabled, f.is_enabled) AS is_enabled,
                    f.phase,
                    f.category
                FROM feature_flags f
                LEFT JOIN tenant_feature_flags t
                    ON t.flag_key = f.flag_key AND t.tenant_id = %s
                ORDER BY f.phase, f.category, f.label
            """, (tenant_id,))
            return [_row_to_flag(r) for r in cur.fetchall()]
    finally:
        conn.close()


def _row_to_flag(r) -> FeatureFlag:
    return FeatureFlag(
        flag_key=r[0], label=r[1], description=r[2],
        is_enabled=r[3], phase=r[4], category=r[5],
    )


def _assert_tenant_access(current: dict, tenant_id: str):
    """Superadmin/isource_admin can access any tenant; others only their own."""
    role = current.get("role", "")
    if role in ("superadmin", "isource_admin"):
        return
    if current.get("tenant_id") != tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")
