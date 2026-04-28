"""
Auth router — login, SSO, refresh, me, logout, register.
"""
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr

from auth_utils import (
    create_access_token, create_refresh_token, decode_token,
    hash_password, verify_password, get_current_user, require_auth,
)
from database import query

router = APIRouter(tags=["auth"])


# ── Request / Response models ─────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class SSORequest(BaseModel):
    id_token: str           # MSAL-issued id_token (already validated client-side)
    display_name: Optional[str] = None

class RefreshRequest(BaseModel):
    refresh_token: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str
    tenant_id: Optional[str] = None
    role: str = "viewer"

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class UserOut(BaseModel):
    id: str
    email: str
    display_name: Optional[str]
    role: str
    tenant_id: Optional[str]
    tenant_name: Optional[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_token_response(user_row: dict) -> dict:
    access  = create_access_token(str(user_row["id"]), str(user_row["tenant_id"]) if user_row["tenant_id"] else None, user_row["role"])
    refresh = create_refresh_token(str(user_row["id"]))
    return {
        "access_token":  access,
        "refresh_token": refresh,
        "token_type":    "bearer",
        "user": {
            "id":           str(user_row["id"]),
            "email":        user_row["email"],
            "display_name": user_row["display_name"],
            "role":         user_row["role"],
            "tenant_id":    str(user_row["tenant_id"]) if user_row["tenant_id"] else None,
            "tenant_name":  user_row.get("tenant_name"),
        },
    }


def _get_user_by_email(email: str) -> Optional[dict]:
    rows = query("""
        SELECT u.id, u.email, u.password_hash, u.display_name, u.role,
               u.is_active, u.tenant_id, u.azure_oid,
               t.name AS tenant_name
        FROM users u
        LEFT JOIN tenants t ON t.id = u.tenant_id
        WHERE u.email = %s
    """, (email,))
    return rows[0] if rows else None


def _get_user_by_id(user_id: str) -> Optional[dict]:
    rows = query("""
        SELECT u.id, u.email, u.display_name, u.role,
               u.is_active, u.tenant_id,
               t.name AS tenant_name
        FROM users u
        LEFT JOIN tenants t ON t.id = u.tenant_id
        WHERE u.id = %s
    """, (user_id,))
    return rows[0] if rows else None


def _update_last_login(user_id: str):
    query("UPDATE users SET last_login = NOW() WHERE id = %s", (user_id,))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/auth/login")
def login(req: LoginRequest):
    """Email + password login → JWT pair."""
    user = _get_user_by_email(req.email)
    if not user or not user["is_active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user["password_hash"] or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    _update_last_login(str(user["id"]))
    return _build_token_response(user)


@router.post("/auth/sso")
def sso_login(req: SSORequest):
    """
    MSAL SSO login — frontend validates MSAL token, sends id_token here.
    We decode the Azure JWT (no sig verify in dev; use JWKS in prod) to get oid + email.
    If user doesn't exist, auto-create them linked to default tenant.
    """
    import base64, json as _json

    try:
        # Decode claims from id_token payload (no signature verify — dev mode)
        parts = req.id_token.split(".")
        padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
        claims = _json.loads(base64.urlsafe_b64decode(padded))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id_token format")

    oid   = claims.get("oid") or claims.get("sub")
    email = claims.get("preferred_username") or claims.get("email") or claims.get("upn")
    name  = req.display_name or claims.get("name") or email

    if not email:
        raise HTTPException(status_code=400, detail="id_token missing email claim")

    # Find or create user
    rows = query("SELECT id FROM users WHERE azure_oid = %s OR email = %s", (oid, email))
    if rows:
        user_id = str(rows[0]["id"])
        query("UPDATE users SET azure_oid=%s, last_login=NOW() WHERE id=%s", (oid, user_id))
    else:
        # Get default tenant id
        tenants = query("SELECT id FROM tenants WHERE slug='ria-advisory' LIMIT 1")
        default_tid = str(tenants[0]["id"]) if tenants else None
        query(
            "INSERT INTO users (email, display_name, azure_oid, tenant_id, role) VALUES (%s,%s,%s,%s,%s)",
            (email, name, oid, default_tid, "viewer"),
        )
        rows2 = query("SELECT id FROM users WHERE email=%s", (email,))
        user_id = str(rows2[0]["id"])

    user = _get_user_by_id(user_id)
    if not user or not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account inactive")
    return _build_token_response(user)


@router.post("/auth/refresh")
def refresh_token(req: RefreshRequest):
    """Refresh access token using refresh_token."""
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=400, detail="Invalid token type")
    user = _get_user_by_id(payload["sub"])
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    access = create_access_token(str(user["id"]), str(user["tenant_id"]) if user["tenant_id"] else None, user["role"])
    return {"access_token": access, "token_type": "bearer"}


@router.get("/auth/me")
def me(current: dict = Depends(require_auth)):
    """Return current user info."""
    user = _get_user_by_id(current["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id":           str(user["id"]),
        "email":        user["email"],
        "display_name": user["display_name"],
        "role":         user["role"],
        "tenant_id":    str(user["tenant_id"]) if user["tenant_id"] else None,
        "tenant_name":  user.get("tenant_name"),
    }


@router.post("/auth/logout")
def logout():
    """Stateless logout — client discards token. Endpoint for symmetry."""
    return {"message": "Logged out"}


@router.post("/auth/register")
def register(req: RegisterRequest, current: Optional[dict] = Depends(get_current_user)):
    """Create new user. Open for first-user bootstrap; requires admin after that."""
    # Allow first-user bootstrap (no users in DB yet) — no token needed
    count = query("SELECT COUNT(*) AS cnt FROM users")
    is_first = count[0]["cnt"] == 0

    if not is_first and (not current or current.get("role") not in ("superadmin", "ria_admin", "isource_admin", "tenant_admin")):
        raise HTTPException(status_code=403, detail="Only admins can register users")

    existing = query("SELECT id FROM users WHERE email=%s", (req.email,))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    role = "superadmin" if is_first else req.role
    tid  = req.tenant_id

    # First user gets default tenant
    if is_first:
        tenants = query("SELECT id FROM tenants WHERE slug='ria-advisory' LIMIT 1")
        tid = str(tenants[0]["id"]) if tenants else None

    query(
        "INSERT INTO users (email, password_hash, display_name, tenant_id, role) VALUES (%s,%s,%s,%s,%s)",
        (req.email, hash_password(req.password), req.display_name, tid, role),
    )
    rows = query("SELECT id FROM users WHERE email=%s", (req.email,))
    user = _get_user_by_id(str(rows[0]["id"]))
    return _build_token_response(user)
