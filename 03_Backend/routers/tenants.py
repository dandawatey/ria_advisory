"""
Tenants router — multi-org tenant + user management.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from auth_utils import require_auth, require_superadmin, require_tenant_admin, require_any_admin, hash_password
from database import query

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


# ── Models ────────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str
    slug: str
    plan: str = "trial"

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[dict] = None

class UserInvite(BaseModel):
    email: str
    display_name: str
    role: str = "viewer"
    password: Optional[str] = None      # optional — user can set later

class UserRoleUpdate(BaseModel):
    role: str


# ── Tenant CRUD ───────────────────────────────────────────────────────────────

@router.get("")
def list_tenants(current: dict = Depends(require_superadmin)):
    rows = query("""
        SELECT t.id, t.name, t.slug, t.plan, t.status, t.created_at,
               COUNT(u.id) AS user_count
        FROM tenants t
        LEFT JOIN users u ON u.tenant_id = t.id AND u.is_active = true
        WHERE t.status != 'deleted'
        GROUP BY t.id
        ORDER BY t.created_at DESC
    """)
    return [_serialize_tenant(r) for r in rows]


@router.post("", status_code=201)
def create_tenant(req: TenantCreate, current: dict = Depends(require_superadmin)):
    existing = query("SELECT id FROM tenants WHERE slug=%s", (req.slug,))
    if existing:
        raise HTTPException(status_code=409, detail="Slug already exists")
    query(
        "INSERT INTO tenants (name, slug, plan) VALUES (%s,%s,%s)",
        (req.name, req.slug, req.plan),
    )
    rows = query("SELECT * FROM tenants WHERE slug=%s", (req.slug,))
    return _serialize_tenant(rows[0])


@router.get("/{tenant_id}")
def get_tenant(tenant_id: str, current: dict = Depends(require_auth)):
    _assert_tenant_access(current, tenant_id)
    rows = query("SELECT * FROM tenants WHERE id=%s AND status!='deleted'", (tenant_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _serialize_tenant(rows[0])


@router.put("/{tenant_id}")
def update_tenant(tenant_id: str, req: TenantUpdate, current: dict = Depends(require_auth)):
    _assert_tenant_access(current, tenant_id)
    fields, vals = [], []
    if req.name     is not None: fields.append("name=%s");     vals.append(req.name)
    if req.plan     is not None: fields.append("plan=%s");     vals.append(req.plan)
    if req.status   is not None: fields.append("status=%s");   vals.append(req.status)
    if req.settings is not None: fields.append("settings=%s"); vals.append(str(req.settings))
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    vals.append(tenant_id)
    query(f"UPDATE tenants SET {', '.join(fields)} WHERE id=%s", tuple(vals))
    rows = query("SELECT * FROM tenants WHERE id=%s", (tenant_id,))
    return _serialize_tenant(rows[0])


@router.delete("/{tenant_id}", status_code=204)
def delete_tenant(tenant_id: str, current: dict = Depends(require_superadmin)):
    query("UPDATE tenants SET status='deleted' WHERE id=%s", (tenant_id,))


# ── User management ───────────────────────────────────────────────────────────

@router.get("/{tenant_id}/users")
def list_users(tenant_id: str, current: dict = Depends(require_auth)):
    _assert_tenant_access(current, tenant_id)
    rows = query("""
        SELECT id, email, display_name, role, is_active, created_at, last_login
        FROM users
        WHERE tenant_id=%s
        ORDER BY created_at DESC
    """, (tenant_id,))
    return [_serialize_user(r) for r in rows]


@router.post("/{tenant_id}/users", status_code=201)
def invite_user(tenant_id: str, req: UserInvite, current: dict = Depends(require_auth)):
    _assert_tenant_access(current, tenant_id)
    existing = query("SELECT id FROM users WHERE email=%s", (req.email,))
    if existing:
        # If user exists in another tenant, move them (or raise)
        raise HTTPException(status_code=409, detail="Email already registered")
    pw_hash = hash_password(req.password) if req.password else None
    query(
        "INSERT INTO users (email, display_name, password_hash, tenant_id, role) VALUES (%s,%s,%s,%s,%s)",
        (req.email, req.display_name, pw_hash, tenant_id, req.role),
    )
    rows = query("SELECT id, email, display_name, role, is_active, created_at, last_login FROM users WHERE email=%s", (req.email,))
    return _serialize_user(rows[0])


@router.put("/{tenant_id}/users/{user_id}")
def update_user_role(tenant_id: str, user_id: str, req: UserRoleUpdate, current: dict = Depends(require_auth)):
    _assert_tenant_access(current, tenant_id)
    rows = query("SELECT id FROM users WHERE id=%s AND tenant_id=%s", (user_id, tenant_id))
    if not rows:
        raise HTTPException(status_code=404, detail="User not found in tenant")
    query("UPDATE users SET role=%s WHERE id=%s", (req.role, user_id))
    updated = query("SELECT id, email, display_name, role, is_active, created_at, last_login FROM users WHERE id=%s", (user_id,))
    return _serialize_user(updated[0])


@router.delete("/{tenant_id}/users/{user_id}", status_code=204)
def remove_user(tenant_id: str, user_id: str, current: dict = Depends(require_auth)):
    _assert_tenant_access(current, tenant_id)
    rows = query("SELECT id FROM users WHERE id=%s AND tenant_id=%s", (user_id, tenant_id))
    if not rows:
        raise HTTPException(status_code=404, detail="User not found in tenant")
    query("UPDATE users SET is_active=false WHERE id=%s", (user_id,))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _assert_tenant_access(current: dict, tenant_id: str):
    """Superadmin can access any tenant; others only their own."""
    if current.get("role") == "superadmin":
        return
    if current.get("tenant_id") != tenant_id:
        raise HTTPException(status_code=403, detail="Access denied to this tenant")


def _serialize_tenant(r: dict) -> dict:
    return {
        "id":         str(r["id"]),
        "name":       r["name"],
        "slug":       r["slug"],
        "plan":       r["plan"],
        "status":     r["status"],
        "user_count": r.get("user_count", 0),
        "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
    }


def _serialize_user(r: dict) -> dict:
    return {
        "id":           str(r["id"]),
        "email":        r["email"],
        "display_name": r["display_name"],
        "role":         r["role"],
        "is_active":    r["is_active"],
        "created_at":   r["created_at"].isoformat() if r.get("created_at") else None,
        "last_login":   r["last_login"].isoformat() if r.get("last_login") else None,
    }


# ── Tenant Config (branding / subsidiaries / billing) ────────────────────────

class TenantConfigUpdate(BaseModel):
    branding:           Optional[dict] = None
    subsidiary_access:  Optional[list] = None
    billing:            Optional[dict] = None


@router.get("/{tenant_id}/config")
def get_tenant_config(tenant_id: str, current: dict = Depends(require_auth)):
    _assert_tenant_access(current, tenant_id)
    rows = query("SELECT settings FROM tenants WHERE id=%s AND status!='deleted'", (tenant_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Tenant not found")
    import json
    raw = rows[0]["settings"]
    settings = raw if isinstance(raw, dict) else (json.loads(raw) if raw else {})
    return {
        "branding":          settings.get("branding", {}),
        "subsidiary_access": settings.get("subsidiary_access", []),
        "billing":           settings.get("billing", {}),
    }


@router.put("/{tenant_id}/config")
def update_tenant_config(tenant_id: str, req: TenantConfigUpdate, current: dict = Depends(require_auth)):
    _assert_tenant_access(current, tenant_id)
    rows = query("SELECT settings FROM tenants WHERE id=%s AND status!='deleted'", (tenant_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Tenant not found")
    import json
    raw = rows[0]["settings"]
    settings = raw if isinstance(raw, dict) else (json.loads(raw) if raw else {})
    if req.branding          is not None: settings["branding"]          = req.branding
    if req.subsidiary_access is not None: settings["subsidiary_access"] = req.subsidiary_access
    if req.billing           is not None: settings["billing"]           = req.billing
    query("UPDATE tenants SET settings=%s WHERE id=%s", (json.dumps(settings), tenant_id))
    return {
        "branding":          settings.get("branding", {}),
        "subsidiary_access": settings.get("subsidiary_access", []),
        "billing":           settings.get("billing", {}),
    }


# ── BC Dynamics Config ────────────────────────────────────────────────────────

class BCConfigUpdate(BaseModel):
    bc_tenant_id:  Optional[str] = None
    client_id:     Optional[str] = None
    client_secret: Optional[str] = None
    environment:   Optional[str] = None
    api_version:   Optional[str] = None


@router.get("/{tenant_id}/bc-config")
def get_bc_config(tenant_id: str, current: dict = Depends(require_auth)):
    _assert_tenant_access(current, tenant_id)
    rows = query("SELECT * FROM tenant_bc_config WHERE tenant_id=%s", (tenant_id,))
    if not rows:
        return {"auth_status": "pending", "environment": "production", "api_version": "v2.0"}
    r = rows[0]
    return {
        "bc_tenant_id": r["bc_tenant_id"],
        "client_id":    r["client_id"],
        "client_secret": "••••••" if r["client_secret"] else None,
        "environment":  r["environment"],
        "api_version":  r["api_version"],
        "auth_status":  r["auth_status"],
        "last_tested":  r["last_tested"].isoformat() if r.get("last_tested") else None,
    }


@router.put("/{tenant_id}/bc-config")
def update_bc_config(tenant_id: str, req: BCConfigUpdate, current: dict = Depends(require_auth)):
    _assert_tenant_access(current, tenant_id)
    existing = query("SELECT id FROM tenant_bc_config WHERE tenant_id=%s", (tenant_id,))
    if existing:
        fields, vals = [], []
        if req.bc_tenant_id  is not None: fields.append("bc_tenant_id=%s");  vals.append(req.bc_tenant_id)
        if req.client_id     is not None: fields.append("client_id=%s");     vals.append(req.client_id)
        if req.client_secret is not None: fields.append("client_secret=%s"); vals.append(req.client_secret)
        if req.environment   is not None: fields.append("environment=%s");   vals.append(req.environment)
        if req.api_version   is not None: fields.append("api_version=%s");   vals.append(req.api_version)
        if fields:
            fields.append("auth_status='pending'")
            fields.append("updated_at=NOW()")
            vals.append(tenant_id)
            query(f"UPDATE tenant_bc_config SET {', '.join(fields)} WHERE tenant_id=%s", tuple(vals))
    else:
        query(
            "INSERT INTO tenant_bc_config (tenant_id, bc_tenant_id, client_id, client_secret, environment, api_version) VALUES (%s,%s,%s,%s,%s,%s)",
            (tenant_id, req.bc_tenant_id, req.client_id, req.client_secret,
             req.environment or "production", req.api_version or "v2.0"),
        )
    rows = query("SELECT * FROM tenant_bc_config WHERE tenant_id=%s", (tenant_id,))
    r = rows[0]
    return {
        "bc_tenant_id": r["bc_tenant_id"],
        "client_id":    r["client_id"],
        "client_secret": "••••••" if r["client_secret"] else None,
        "environment":  r["environment"],
        "api_version":  r["api_version"],
        "auth_status":  r["auth_status"],
        "last_tested":  r["last_tested"].isoformat() if r.get("last_tested") else None,
    }


@router.post("/{tenant_id}/bc-config/test")
def test_bc_config(tenant_id: str, current: dict = Depends(require_auth)):
    """Stub test — tries OAuth token request. Returns status."""
    _assert_tenant_access(current, tenant_id)
    rows = query("SELECT * FROM tenant_bc_config WHERE tenant_id=%s", (tenant_id,))
    if not rows or not rows[0]["client_id"] or not rows[0]["client_secret"]:
        raise HTTPException(status_code=400, detail="BC credentials not configured")
    r = rows[0]
    # Attempt real OAuth token request
    try:
        import httpx, time
        token_url = f"https://login.microsoftonline.com/{r['bc_tenant_id']}/oauth2/v2.0/token"
        resp = httpx.post(token_url, data={
            "grant_type":    "client_credentials",
            "client_id":     r["client_id"],
            "client_secret": r["client_secret"],
            "scope":         "https://api.businesscentral.dynamics.com/.default",
        }, timeout=10)
        status_val = "authenticated" if resp.status_code == 200 else "error"
        detail = None if resp.status_code == 200 else resp.json().get("error_description", "Auth failed")
    except Exception as exc:
        status_val = "error"
        detail = str(exc)
    query(
        "UPDATE tenant_bc_config SET auth_status=%s, last_tested=NOW() WHERE tenant_id=%s",
        (status_val, tenant_id),
    )
    result = {"auth_status": status_val, "last_tested": "now"}
    if detail:
        result["detail"] = detail
    return result
