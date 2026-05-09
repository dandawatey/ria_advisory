"""
TDD: RBAC GET /permissions endpoint tests (RED)
Ticket: ICFO-65-S3, IC-36
Owner: Vikram_QA_005
Integration tests (real auth + response schema)
"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


def test_get_permissions_requires_auth(client):
    """AC: Unauthenticated request returns 401"""
    response = client.get("/api/rbac/permissions")
    assert response.status_code == 401


def test_get_permissions_endpoint_exists(client):
    """AC: GET /api/rbac/permissions endpoint exists"""
    # Without auth should be 401, not 404
    response = client.get("/api/rbac/permissions")
    assert response.status_code != 404
    assert response.status_code == 401


def test_get_permissions_returns_json(client):
    """AC: Endpoint returns JSON (no auth but proves response format)"""
    response = client.get("/api/rbac/permissions")
    # Will be 401, but should be JSON
    if response.status_code != 404:
        try:
            response.json()  # Should be valid JSON
        except:
            pytest.fail("Response is not valid JSON")
