"""
Settings — Application configuration + Business Central Dynamics 365 connection
GET  /api/settings              → all settings (secrets redacted)
POST /api/settings/bc           → upsert BC connection config
POST /api/settings/bc/test      → acquire Azure AD token → test BC OData API
GET  /api/settings/bc/status    → {connected, last_tested, env_name, company_count}
DELETE /api/settings/bc         → clear BC config
"""
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import psycopg2
import psycopg2.extras
from database import get_conn

router = APIRouter(prefix="/api/settings", tags=["settings"])

# ── DB helpers ────────────────────────────────────────────────────────────────

def _get_setting(key: str) -> Optional[str]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT value FROM app_settings WHERE key = %s", (key,))
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def _upsert_setting(key: str, value: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO app_settings (key, value, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            """, (key, value))
        conn.commit()
    finally:
        conn.close()


def _delete_settings_by_prefix(prefix: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM app_settings WHERE key LIKE %s", (f"{prefix}%",))
        conn.commit()
    finally:
        conn.close()


def _get_all_settings() -> dict:
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT key, value, updated_at FROM app_settings ORDER BY key")
            rows = cur.fetchall()
        result = {}
        for row in rows:
            k, v = row["key"], row["value"]
            # Redact secrets
            result[k] = "••••••••" if k.endswith("_secret") or k.endswith("_password") else v
        return result
    finally:
        conn.close()


# ── Pydantic models ───────────────────────────────────────────────────────────

class BCConfig(BaseModel):
    env_name: str = ""
    tenant_id: str = ""
    client_id: str = ""
    client_secret: str = ""       # "" or "••••••••" = keep existing
    company_name: str = ""
    api_version: str = "v2.0"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def get_settings():
    """All app settings — secrets redacted."""
    return _get_all_settings()


@router.get("/bc/status")
def bc_status():
    """Quick BC connection status without re-testing."""
    return {
        "connected":    _get_setting("bc.connected") == "true",
        "last_tested":  _get_setting("bc.last_tested"),
        "env_name":     _get_setting("bc.env_name") or "",
        "company_name": _get_setting("bc.company_name") or "",
        "configured":   bool(_get_setting("bc.tenant_id")),
    }


@router.post("/bc")
def save_bc_config(cfg: BCConfig):
    """Save BC connection config. Skips secret if placeholder sent."""
    PLACEHOLDER = "••••••••"

    _upsert_setting("bc.env_name",     cfg.env_name)
    _upsert_setting("bc.tenant_id",    cfg.tenant_id)
    _upsert_setting("bc.client_id",    cfg.client_id)
    _upsert_setting("bc.company_name", cfg.company_name)
    _upsert_setting("bc.api_version",  cfg.api_version or "v2.0")

    # Only overwrite secret if a real value was provided
    if cfg.client_secret and cfg.client_secret != PLACEHOLDER:
        # Allow env var override — env var takes precedence, but we still store the config
        _upsert_setting("bc.client_secret", cfg.client_secret)

    return {"ok": True, "message": "BC configuration saved"}


@router.post("/bc/test")
def test_bc_connection():
    """
    Acquire Azure AD token via client credentials,
    then hit BC OData /companies endpoint.
    Returns {ok, message, companies[]} or {ok: false, message: error}.
    """
    try:
        import urllib.request
        import urllib.parse
        import json
    except ImportError:
        raise HTTPException(500, "urllib not available")

    # Load config
    tenant_id     = _get_setting("bc.tenant_id")     or ""
    client_id     = _get_setting("bc.client_id")     or ""
    client_secret = os.getenv("BC_CLIENT_SECRET") or _get_setting("bc.client_secret") or ""
    env_name      = _get_setting("bc.env_name")      or "Production"
    api_version   = _get_setting("bc.api_version")   or "v2.0"

    if not tenant_id or not client_id or not client_secret:
        return {"ok": False, "message": "BC configuration incomplete. Please save tenant ID, client ID, and client secret first."}

    # ── Step 1: Acquire token ─────────────────────────────────────────────────
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    token_data = urllib.parse.urlencode({
        "grant_type":    "client_credentials",
        "client_id":     client_id,
        "client_secret": client_secret,
        "scope":         "https://api.businesscentral.dynamics.com/.default",
    }).encode()

    try:
        req = urllib.request.Request(token_url, data=token_data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, timeout=15) as resp:
            token_resp = json.loads(resp.read())
        access_token = token_resp.get("access_token")
        if not access_token:
            err_code = token_resp.get("error", "")
            err_desc = token_resp.get("error_description") or token_resp.get("error") or "Unknown token error"
            # Detect specific Azure AD errors for actionable guidance
            if "AADSTS7000222" in err_desc:
                msg = "Client secret EXPIRED. Go to Azure Portal → App Registrations → {client_id} → Certificates & Secrets → create a new secret and update here."
            elif "AADSTS7000215" in err_desc:
                msg = "Client secret is INVALID. Check that the correct secret value (not the secret ID) was entered in BC settings."
            elif "AADSTS65001" in err_desc:
                msg = "Admin consent required. Go to Azure Portal → Enterprise Applications → grant admin consent for Business Central API permissions."
            elif "AADSTS700016" in err_desc or "AADSTS70011" in err_desc:
                msg = f"Application not found or scope invalid. Verify client_id '{client_id}' exists in tenant '{tenant_id}' and has BC API permissions."
            elif "AADSTS90002" in err_desc:
                msg = f"Tenant '{tenant_id}' not found. Verify the Azure AD tenant ID is correct."
            else:
                msg = f"Azure AD auth failed [{err_code}]: {err_desc[:300]}"
            _upsert_setting("bc.connected", "false")
            _upsert_setting("bc.last_tested", datetime.now(timezone.utc).isoformat())
            return {"ok": False, "message": msg}
    except urllib.error.HTTPError as token_err:
        body = token_err.read().decode(errors="replace")[:300]
        _upsert_setting("bc.connected", "false")
        _upsert_setting("bc.last_tested", datetime.now(timezone.utc).isoformat())
        return {"ok": False, "message": f"Azure AD token endpoint error {token_err.code}: {body}"}
    except Exception as e:
        _upsert_setting("bc.connected", "false")
        _upsert_setting("bc.last_tested", datetime.now(timezone.utc).isoformat())
        return {"ok": False, "message": f"Token request failed: {str(e)}"}

    # ── Step 2: Call BC OData companies endpoint ──────────────────────────────
    bc_url = f"https://api.businesscentral.dynamics.com/v2.0/{tenant_id}/{env_name}/api/{api_version}/companies"

    try:
        req2 = urllib.request.Request(bc_url, method="GET")
        req2.add_header("Authorization", f"Bearer {access_token}")
        req2.add_header("Accept", "application/json")
        with urllib.request.urlopen(req2, timeout=15) as resp2:
            bc_resp = json.loads(resp2.read())
        companies = [
            {"id": c.get("id"), "name": c.get("name"), "displayName": c.get("displayName")}
            for c in bc_resp.get("value", [])
        ]
        _upsert_setting("bc.connected", "true")
        _upsert_setting("bc.last_tested", datetime.now(timezone.utc).isoformat())
        return {
            "ok": True,
            "message": f"Connected — {len(companies)} company(ies) found",
            "companies": companies,
        }
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")[:300]
        _upsert_setting("bc.connected", "false")
        _upsert_setting("bc.last_tested", datetime.now(timezone.utc).isoformat())
        if e.code == 401:
            msg = (
                f"BC rejected the access token (401 Unauthorized). "
                f"Check: (1) App registration '{client_id}' has 'Financials.ReadWrite.All' or equivalent BC API permission. "
                f"(2) BC environment name '{env_name}' is correct. "
                f"(3) Admin granted consent in Azure Portal → Enterprise Applications. "
                f"Detail: {body[:200]}"
            )
        elif e.code == 403:
            msg = f"BC access forbidden (403). App lacks permission to this BC environment. Detail: {body[:200]}"
        elif e.code == 404:
            msg = f"BC environment '{env_name}' not found (404). Verify the environment name matches exactly in BC Admin Center."
        else:
            msg = f"BC API error {e.code}: {body}"
        return {"ok": False, "message": msg}
    except Exception as e:
        _upsert_setting("bc.connected", "false")
        _upsert_setting("bc.last_tested", datetime.now(timezone.utc).isoformat())
        return {"ok": False, "message": f"BC connection failed: {str(e)}"}


@router.delete("/bc")
def clear_bc_config():
    """Remove all BC configuration."""
    _delete_settings_by_prefix("bc.")
    return {"ok": True, "message": "BC configuration cleared"}
