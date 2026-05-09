"""
Auth utilities — JWT creation/verification + FastAPI dependencies.
"""
import json
import os
import re
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import bcrypt as _bcrypt
from jose import JWTError, jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY      = os.getenv("JWT_SECRET", "change-me-in-production-use-long-random-string")
ALGORITHM       = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_MINUTES  = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
REFRESH_DAYS    = int(os.getenv("JWT_REFRESH_DAYS", "7"))

oauth2_scheme   = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# ── Token creation ────────────────────────────────────────────────────────────

def create_access_token(user_id: str, tenant_id: Optional[str], role: str) -> str:
    payload = {
        "sub":       user_id,
        "tenant_id": tenant_id,
        "role":      role,
        "type":      "access",
        "exp":       datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub":  user_id,
        "type": "refresh",
        "exp":  datetime.utcnow() + timedelta(days=REFRESH_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_impersonation_token(
    user_id: str,
    tenant_id: Optional[str],
    role: str,
    impersonated_by: str,
    subsidiary_access: Optional[list] = None,
) -> str:
    """
    Short-lived token (1 hour) that carries the target user's identity
    but marks that it was issued by an admin for impersonation.
    Non-refreshable by design.
    """
    payload = {
        "sub":               user_id,
        "tenant_id":         tenant_id,
        "role":              role,
        "type":              "access",
        "impersonated_by":   impersonated_by,   # admin's user_id
        "subsidiary_access": subsidiary_access,
        "exp":               datetime.utcnow() + timedelta(minutes=60),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── FastAPI dependencies ──────────────────────────────────────────────────────

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[dict]:
    """Dependency: extracts + validates JWT. Returns None if no token (for optional-auth endpoints)."""
    if not token:
        return None
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    return payload


async def require_auth(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    """Dependency: like get_current_user but raises 401 if no token."""
    user = await get_current_user(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_role(*roles: str):
    """Dependency factory: enforces one of the given roles."""
    async def _check(current: dict = Depends(require_auth)):
        if current.get("role") not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {' or '.join(roles)}",
            )
        return current
    return _check


# ── Convenience role deps ─────────────────────────────────────────────────────
require_superadmin    = require_role("superadmin")
require_ria_admin     = require_role("superadmin", "ria_admin")
require_isource_admin = require_role("superadmin", "isource_admin")
require_any_admin     = require_role("superadmin", "ria_admin", "isource_admin")
require_tenant_admin  = require_role("superadmin", "ria_admin", "isource_admin")   # backward compat alias
require_finance_user  = require_role("superadmin", "ria_admin", "isource_admin", "finance_user")


# ── Tenant data-access helper ─────────────────────────────────────────────────

def get_allowed_company_ids(current: dict) -> Optional[List[int]]:
    """
    Return allowed company_id list for the current user's tenant.
      None  → superadmin, no restriction (all companies)
      []    → tenant has no subsidiary_access configured → no data
      [1,2] → restrict queries to those company_ids

    Precedence:
    1. superadmin → unrestricted (None)
    2. JWT impersonation token with subsidiary_access claim → use that list
    3. Per-user subsidiary_access in DB (if not NULL) → intersect with tenant list
    4. Tenant-level subsidiary_access from settings → use that list

    subsidiary_access codes are like 'RIA001'…'RIA017'; the trailing number
    maps directly to dim_company.company_id (1-based).
    """
    if current.get("role") == "superadmin":
        return None                          # unrestricted

    tid = current.get("tenant_id")
    if not tid:
        return []                            # no tenant → no data

    def _codes_to_ids(codes: list) -> List[int]:
        ids: List[int] = []
        for code in codes:
            m = re.search(r"\d+$", str(code))
            if m:
                ids.append(int(m.group()))
        return ids

    from database import query as _q        # local import avoids circular deps

    # JWT may carry per-user subsidiary_access from impersonation token
    jwt_access = current.get("subsidiary_access")
    if jwt_access is not None:
        return _codes_to_ids(jwt_access) if jwt_access else []

    # Check per-user subsidiary_access in DB
    user_id = current.get("sub")
    if user_id:
        user_rows = _q("SELECT subsidiary_access FROM users WHERE id=%s", (user_id,))
        if user_rows and user_rows[0]["subsidiary_access"] is not None:
            user_codes = user_rows[0]["subsidiary_access"]
            if isinstance(user_codes, str):
                user_codes = json.loads(user_codes)
            if not user_codes:
                return []
            # Intersect with tenant-level access below
            tenant_rows = _q("SELECT settings FROM tenants WHERE id=%s", (tid,))
            if not tenant_rows:
                return []
            raw = tenant_rows[0]["settings"]
            settings = raw if isinstance(raw, dict) else (json.loads(raw) if raw else {})
            tenant_codes: list = settings.get("subsidiary_access", [])
            if not tenant_codes:
                return _codes_to_ids(user_codes)
            effective = [c for c in user_codes if c in set(tenant_codes)]
            return _codes_to_ids(effective)

    # Fall back to tenant-level access
    rows = _q("SELECT settings FROM tenants WHERE id=%s", (tid,))
    if not rows:
        return []

    raw = rows[0]["settings"]
    settings = raw if isinstance(raw, dict) else (json.loads(raw) if raw else {})
    codes: list = settings.get("subsidiary_access", [])

    if not codes:
        # No subsidiary_access codes configured → fall back to dim_company.tenant_id
        company_rows = _q(
            "SELECT company_id FROM dim_company WHERE tenant_id = %s ORDER BY company_id",
            (tid,)
        )
        if company_rows:
            return [r["company_id"] for r in company_rows]
        return []                            # tenant has no companies at all

    return _codes_to_ids(codes)


def get_casbin_subject(current: dict) -> tuple:
    """Return (role, domain) for Casbin enforcement."""
    role   = current.get("role", "viewer")
    domain = current.get("tenant_id") or "*"
    return role, domain


# ── Scope-based Decorator (for protecting endpoints by permission scope) ──────

def require_auth(scope: str = "sync:read"):
    """
    Decorator: verify Bearer token + check scope.
    Usage: @require_auth(scope="admin")

    Raises:
      401 if token missing/invalid
      403 if scope insufficient
    """
    from functools import wraps

    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            auth_header = request.headers.get("authorization", "")

            if not auth_header.startswith("Bearer "):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Missing token"
                )

            token = auth_header[7:]

            try:
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            except JWTError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )

            token_scope = payload.get("scope", "")
            token_scopes = token_scope.split() if token_scope else []

            if scope not in token_scopes:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )

            if hasattr(request, "state"):
                request.state.tenant_id = payload.get("tenant_id")
                request.state.user_id = payload.get("sub")
                request.state.scope = token_scope

            return func(request, *args, **kwargs)

        return wrapper

    return decorator
