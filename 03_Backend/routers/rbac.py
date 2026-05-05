"""
RBAC management router — IC-34
Tenant admin: assign roles, set subsidiary access, impersonate users.

Prefix: /api/rbac
"""
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from auth_utils import require_auth, create_impersonation_token
from casbin_enforcer import get_enforcer, reload_policy, is_higher_privilege, ROLE_ORDER
from database import query

router = APIRouter(prefix="/api/rbac", tags=["rbac"])

# ── Allowed roles that can be assigned by a tenant admin ─────────────────────
ASSIGNABLE_ROLES = {"viewer", "finance_user", "finance_user", "ria_admin", "isource_admin"}


# ── Request models ────────────────────────────────────────────────────────────

class RoleAssignRequest(BaseModel):
    user_id: str
    role: str


class SubsidiaryAccessRequest(BaseModel):
    user_id: str
    subsidiary_access: Optional[List[str]] = None   # None = inherit from tenant


class ImpersonateRequest(BaseModel):
    reason: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _assert_admin(current: dict) -> None:
    role = current.get("role", "")
    if role not in ("superadmin", "ria_admin", "isource_admin"):
        raise HTTPException(status_code=403, detail="Tenant admin role required")


def _assert_same_tenant(current: dict, target_tenant_id: str) -> None:
    """Enforce tenant boundary — admin can only manage users in their own tenant."""
    if current.get("role") == "superadmin":
        return
    if current.get("tenant_id") != target_tenant_id:
        raise HTTPException(status_code=403, detail="Cannot manage users in another tenant")


def _get_user_or_404(user_id: str) -> dict:
    rows = query(
        "SELECT id, email, display_name, role, tenant_id, is_active, subsidiary_access "
        "FROM users WHERE id = %s",
        (user_id,)
    )
    if not rows:
        raise HTTPException(status_code=404, detail="User not found")
    return rows[0]


# ── Role listing ──────────────────────────────────────────────────────────────

@router.get("/roles")
def list_roles(current: dict = Depends(require_auth)):
    """Return available roles in privilege order."""
    _assert_admin(current)
    return [
        {"role": "viewer",         "label": "Viewer",         "description": "Read-only dashboards and reports"},
        {"role": "finance_user",   "label": "Finance User",   "description": "Full read access to all financial data"},
        {"role": "ria_admin",      "label": "RIA Admin",      "description": "Manage users, roles, and tenant config"},
        {"role": "isource_admin",  "label": "iSource Admin",  "description": "Manage users, roles, and tenant config"},
        {"role": "superadmin",     "label": "Super Admin",    "description": "Full platform access (i-Source only)"},
    ]


# ── Users list with Casbin enrichment ────────────────────────────────────────

@router.get("/users")
def list_rbac_users(current: dict = Depends(require_auth)):
    """List all users in the calling admin's tenant with their roles and subsidiary access."""
    _assert_admin(current)

    tenant_id = current.get("tenant_id")
    if current.get("role") == "superadmin" and not tenant_id:
        raise HTTPException(status_code=400, detail="Supply tenant_id query param for superadmin")

    rows = query(
        """
        SELECT id, email, display_name, role, is_active,
               subsidiary_access, created_at, last_login
        FROM users
        WHERE tenant_id = %s
        ORDER BY created_at DESC
        """,
        (tenant_id,)
    )
    return [_serialize_rbac_user(r) for r in rows]


# ── Role assignment ───────────────────────────────────────────────────────────

@router.post("/assign-role")
def assign_role(req: RoleAssignRequest, current: dict = Depends(require_auth)):
    """
    Tenant admin assigns a role to a user within the same tenant.
    - Cannot elevate a user above the admin's own role.
    - Syncs Casbin policy immediately.
    """
    _assert_admin(current)

    target = _get_user_or_404(req.user_id)
    _assert_same_tenant(current, str(target["tenant_id"]))

    if req.role not in ASSIGNABLE_ROLES and current.get("role") != "superadmin":
        raise HTTPException(status_code=400, detail=f"Invalid role: {req.role}")

    # Prevent privilege escalation — admin cannot assign a role higher than their own
    admin_role = current.get("role", "viewer")
    if not is_higher_privilege(admin_role, req.role) and admin_role != req.role:
        raise HTTPException(
            status_code=403,
            detail=f"Cannot assign role '{req.role}' — exceeds your privilege level"
        )

    # Update users table
    query("UPDATE users SET role = %s WHERE id = %s", (req.role, req.user_id))

    # Reload Casbin policies so new role takes effect immediately
    reload_policy()

    updated = _get_user_or_404(req.user_id)
    return {
        "message": f"Role updated to '{req.role}'",
        "user": _serialize_rbac_user(updated),
    }


# ── Subsidiary access assignment ──────────────────────────────────────────────

@router.post("/subsidiary-access")
def set_subsidiary_access(req: SubsidiaryAccessRequest, current: dict = Depends(require_auth)):
    """
    Tenant admin sets per-user subsidiary access list.
    Pass subsidiary_access=null to inherit from tenant settings.
    Pass subsidiary_access=[] to revoke all subsidiary access.
    """
    _assert_admin(current)

    target = _get_user_or_404(req.user_id)
    _assert_same_tenant(current, str(target["tenant_id"]))

    import json
    access_val = json.dumps(req.subsidiary_access) if req.subsidiary_access is not None else None
    query("UPDATE users SET subsidiary_access = %s WHERE id = %s", (access_val, req.user_id))

    updated = _get_user_or_404(req.user_id)
    return {
        "message": "Subsidiary access updated",
        "user": _serialize_rbac_user(updated),
    }


# ── Impersonation: start ──────────────────────────────────────────────────────

@router.post("/impersonate/{target_user_id}")
def start_impersonation(
    target_user_id: str,
    req: ImpersonateRequest,
    request: Request,
    current: dict = Depends(require_auth),
):
    """
    Tenant admin obtains a short-lived impersonation token for a lower-privilege user.

    Rules:
    - Admin must be ria_admin, isource_admin, or superadmin.
    - Cannot impersonate a user of equal or higher privilege.
    - Cannot impersonate across tenants (except superadmin).
    - Cannot impersonate if already impersonating (no nesting).
    - Token carries impersonated_by claim; expires in 1 hour; non-refreshable.
    """
    # Block nested impersonation
    if current.get("impersonated_by"):
        raise HTTPException(status_code=403, detail="Cannot impersonate while already impersonating")

    _assert_admin(current)

    target = _get_user_or_404(target_user_id)
    if not target["is_active"]:
        raise HTTPException(status_code=400, detail="Cannot impersonate inactive user")

    _assert_same_tenant(current, str(target["tenant_id"]))

    admin_role  = current.get("role", "viewer")
    target_role = target["role"]

    if not is_higher_privilege(admin_role, target_role):
        raise HTTPException(
            status_code=403,
            detail=f"Cannot impersonate user with role '{target_role}' — must be strictly lower privilege"
        )

    # Issue impersonation token
    imp_token = create_impersonation_token(
        user_id=str(target["id"]),
        tenant_id=str(target["tenant_id"]),
        role=target_role,
        impersonated_by=current["sub"],
        subsidiary_access=target.get("subsidiary_access"),
    )

    # Audit log
    ip = request.client.host if request.client else None
    query(
        """
        INSERT INTO impersonation_audit
            (admin_id, target_user_id, tenant_id, reason, ip_address)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (current["sub"], target_user_id, str(target["tenant_id"]), req.reason, ip)
    )

    return {
        "impersonation_token": imp_token,
        "impersonating": {
            "id":           str(target["id"]),
            "email":        target["email"],
            "display_name": target["display_name"],
            "role":         target_role,
        },
        "expires_in_minutes": 60,
        "message": f"Now impersonating {target['display_name'] or target['email']}",
    }


# ── Impersonation: stop ───────────────────────────────────────────────────────

@router.post("/impersonate/stop")
def stop_impersonation(current: dict = Depends(require_auth)):
    """
    Records the end of an impersonation session in the audit log.
    The frontend is responsible for discarding the impersonation token.
    """
    impersonated_by = current.get("impersonated_by")
    if not impersonated_by:
        raise HTTPException(status_code=400, detail="Not currently impersonating")

    # Mark the most recent active impersonation audit row as stopped
    query(
        """
        UPDATE impersonation_audit
        SET stopped_at = NOW()
        WHERE target_user_id = %s
          AND admin_id = %s
          AND stopped_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
        """,
        (current["sub"], impersonated_by)
    )

    return {"message": "Impersonation ended"}


# ── Impersonation audit log ───────────────────────────────────────────────────

@router.get("/impersonation-audit")
def get_impersonation_audit(current: dict = Depends(require_auth)):
    """Tenant admin: view impersonation history within their tenant."""
    _assert_admin(current)

    tenant_id = current.get("tenant_id")
    rows = query(
        """
        SELECT
            ia.id, ia.started_at, ia.stopped_at, ia.reason, ia.ip_address,
            a.email  AS admin_email,  a.display_name  AS admin_name,
            t.email  AS target_email, t.display_name  AS target_name, t.role AS target_role
        FROM impersonation_audit ia
        JOIN users a ON a.id = ia.admin_id
        JOIN users t ON t.id = ia.target_user_id
        WHERE ia.tenant_id = %s
        ORDER BY ia.started_at DESC
        LIMIT 200
        """,
        (tenant_id,)
    )
    return [_serialize_audit(r) for r in rows]


# ── Serialisers ───────────────────────────────────────────────────────────────

def _serialize_rbac_user(r: dict) -> dict:
    import json
    sub_raw = r.get("subsidiary_access")
    sub_list = sub_raw if isinstance(sub_raw, list) else (
        json.loads(sub_raw) if isinstance(sub_raw, str) else None
    )
    return {
        "id":                 str(r["id"]),
        "email":              r["email"],
        "display_name":       r.get("display_name"),
        "role":               r["role"],
        "is_active":          r.get("is_active", True),
        "subsidiary_access":  sub_list,
        "created_at":         r["created_at"].isoformat() if r.get("created_at") else None,
        "last_login":         r["last_login"].isoformat()  if r.get("last_login")  else None,
    }


def _serialize_audit(r: dict) -> dict:
    return {
        "id":           str(r["id"]),
        "admin_email":  r["admin_email"],
        "admin_name":   r["admin_name"],
        "target_email": r["target_email"],
        "target_name":  r["target_name"],
        "target_role":  r["target_role"],
        "started_at":   r["started_at"].isoformat() if r.get("started_at") else None,
        "stopped_at":   r["stopped_at"].isoformat()  if r.get("stopped_at")  else None,
        "reason":       r.get("reason"),
        "ip_address":   r.get("ip_address"),
    }
