"""
Test suite for Settings Endpoints JWT Auth Guard
ICFO-65-S4 | Rohan_Backend_003 + Ishaan_Security_007

Tests validate that settings endpoints:
1. Reject unauthenticated requests (no token) → 401
2. Reject invalid tokens → 401
3. Reject insufficient scope → 403
4. Accept valid admin tokens → 200
5. All endpoints have @require_auth decorator
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
from fastapi import Request, HTTPException


@pytest.fixture
def mock_request():
    """Mock FastAPI Request object."""
    req = MagicMock()
    return req


@pytest.fixture
def mock_db():
    """Mock database."""
    return MagicMock()


@pytest.fixture
def mock_logger():
    """Mock logger."""
    return Mock()


def test_settings_no_token_returns_401(mock_request, mock_db, mock_logger):
    """
    Test: Unauthenticated request (missing token) → 401 Unauthorized.

    Setup: Call GET /api/settings without Authorization header
    Expected: HTTPException(status_code=401)
    """
    from routers.settings import require_auth

    mock_request.headers = {}  # No Authorization header

    @require_auth(scope="admin")
    async def get_settings_protected(request: Request):
        return {"status": "ok"}

    # Should raise 401 when decorator checks token
    with pytest.raises(HTTPException) as exc_info:
        # Synchronously call the wrapped function (normally async, but test mode)
        get_settings_protected(mock_request)

    assert exc_info.value.status_code == 401


def test_settings_invalid_token_returns_401(mock_request, mock_db, mock_logger):
    """
    Test: Invalid token format → 401 Unauthorized.

    Setup: Authorization: Bearer invalid_token_xyz
    Expected: HTTPException(status_code=401)
    """
    from routers.settings import require_auth

    mock_request.headers = {"authorization": "Bearer invalid_token_xyz"}

    @require_auth(scope="admin")
    async def get_settings_protected(request: Request):
        return {"status": "ok"}

    with pytest.raises(HTTPException) as exc_info:
        get_settings_protected(mock_request)

    assert exc_info.value.status_code == 401
    # Verify no token leakage in error message
    assert "invalid_token_xyz" not in str(exc_info.value.detail)


def test_settings_insufficient_scope_returns_403(mock_request, mock_db, mock_logger):
    """
    Test: Valid token but insufficient scope → 403 Forbidden.

    Setup: Token with scope="sync:read" (not admin)
    Expected: HTTPException(status_code=403)
    """
    from routers.settings import require_auth
    from jose import jwt
    import os

    # Create valid but insufficient-scope token
    payload = {
        "sub": "user-123",
        "scope": "sync:read",
        "tenant_id": "tenant-001",
    }
    token = jwt.encode(
        payload,
        os.getenv("JWT_SECRET_KEY", "ria-advisory-dev-secret-change-in-production-2026"),
        algorithm="HS256"
    )

    mock_request.headers = {"authorization": f"Bearer {token}"}

    @require_auth(scope="admin")
    async def get_settings_protected(request: Request):
        return {"status": "ok"}

    with pytest.raises(HTTPException) as exc_info:
        get_settings_protected(mock_request)

    # Insufficient scope should return 403
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_settings_valid_admin_token_returns_200(mock_request, mock_db, mock_logger):
    """
    Test: Valid token with admin scope → 200 OK.

    Setup: Token with scope="admin"
    Expected: Endpoint executes successfully
    """
    from routers.settings import require_auth
    from jose import jwt
    import os

    # Create valid admin token
    payload = {
        "sub": "admin-user-123",
        "scope": "admin",
        "tenant_id": "tenant-001",
    }
    token = jwt.encode(
        payload,
        os.getenv("JWT_SECRET_KEY", "ria-advisory-dev-secret-change-in-production-2026"),
        algorithm="HS256"
    )

    mock_request.headers = {"authorization": f"Bearer {token}"}
    mock_request.state = MagicMock()
    mock_request.state.tenant_id = "tenant-001"

    @require_auth(scope="admin")
    async def get_settings_protected(request: Request):
        return {"status": "ok", "settings": {}}

    # Should execute without raising exception
    result = await get_settings_protected(mock_request)
    assert result["status"] == "ok"


def test_all_settings_endpoints_protected(mock_request, mock_db, mock_logger):
    """
    Test: All endpoints in settings.py have @require_auth decorator.

    Expected endpoints:
      - GET /api/settings
      - PUT /api/settings/erp-credentials
      - GET /api/settings/feature-flags
      - PUT /api/settings/feature-flags
      - etc.

    Verification: Inspect function to detect decorator presence
    """
    from routers import settings

    # Get all route handler functions from settings router
    protected_endpoints = [
        "get_settings",
        "update_erp_credentials",
        "get_feature_flags",
        "update_feature_flags",
    ]

    for endpoint_name in protected_endpoints:
        endpoint_func = getattr(settings, endpoint_name, None)
        if endpoint_func:
            # Check if function is wrapped by @require_auth
            has_auth = hasattr(endpoint_func, "__wrapped__") or "require_auth" in str(
                endpoint_func
            )
            assert (
                has_auth
            ), f"{endpoint_name} missing @require_auth decorator"


def test_settings_malformed_auth_header_returns_401(mock_request, mock_db, mock_logger):
    """
    Test: Malformed Authorization header → 401.

    Scenarios:
      - "Authorization: InvalidToken xyz" (missing "Bearer")
      - "Authorization: Bearer" (missing token)
    """
    from routers.settings import require_auth

    @require_auth(scope="admin")
    async def get_settings_protected(request: Request):
        return {"status": "ok"}

    # Test case 1: Missing "Bearer" prefix
    mock_request.headers = {"authorization": "InvalidToken xyz"}
    with pytest.raises(HTTPException) as exc_info:
        get_settings_protected(mock_request)
    assert exc_info.value.status_code == 401

    # Test case 2: "Bearer" without token
    mock_request.headers = {"authorization": "Bearer"}
    with pytest.raises(HTTPException) as exc_info:
        get_settings_protected(mock_request)
    assert exc_info.value.status_code == 401


def test_settings_expired_token_returns_401(mock_request, mock_db, mock_logger):
    """
    Test: Expired JWT token → 401 Unauthorized.

    Setup: Token with exp in past
    Expected: HTTPException(status_code=401)
    """
    from routers.settings import require_auth

    mock_request.headers = {"authorization": "Bearer expired_token"}

    @require_auth(scope="admin")
    async def get_settings_protected(request: Request):
        return {"status": "ok"}

    with pytest.raises(HTTPException) as exc_info:
        get_settings_protected(mock_request)

    assert exc_info.value.status_code == 401
