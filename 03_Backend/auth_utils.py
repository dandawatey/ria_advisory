"""
Auth utilities — JWT creation/verification + FastAPI dependencies.
"""
import os
from datetime import datetime, timedelta
from typing import Optional

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
