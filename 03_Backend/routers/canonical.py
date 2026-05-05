"""
canonical.py — ERP-agnostic canonical account model endpoints.
Prefix: /api/canonical

Endpoints:
  GET  /api/canonical/accounts              — list dim_canonical_account
  GET  /api/canonical/mappings              — list account_mapping for current tenant+erp
  PUT  /api/canonical/mappings/{acct}       — update mapping (user override)
  POST /api/canonical/mappings/auto-map     — re-run auto-map for unmapped accounts
  GET  /api/canonical/stats                 — coverage stats
  GET  /api/canonical/erp-types             — distinct source_erp values
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import query
from auth_utils import require_auth

router = APIRouter(prefix="/api/canonical", tags=["canonical"])


# ── Category / prefix maps (mirrors seed_canonical.py) ───────────────────────

_CATEGORY_TO_L2 = {
    "Revenue":             "Revenue",
    "Income":              "Revenue",
    "COGS":                "COGS",
    "OpEx":                "OpEx",
    "Expense":             "OpEx",
    "Interest":            "Other Expense",
    "Tax":                 "Income Tax",
    "Current Assets":      "Current Assets",
    "Fixed Assets":        "Fixed Assets",
    "Assets":              "Other Assets",
    "Intangibles":         "Fixed Assets",
    "Investments":         "Other Assets",
    "Current Liabilities": "Current Liabilities",
    "LT Liabilities":      "LT Liabilities",
    "Liabilities":         "LT Liabilities",
    "Equity":              "Equity",
    "Cash Flow":           "Operating Activities",
    "FX":                  "Other Income",
}

_PREFIX_TO_L2 = {
    "4": "Revenue",
    "5": "COGS",
    "6": "OpEx",
    "7": "Other Income",
    "8": "Income Tax",
    "1": "Current Assets",
    "2": "Current Liabilities",
    "3": "Equity",
}


# ── Pydantic models ────────────────────────────────────────────────────────────

class MappingUpdate(BaseModel):
    canonical_id: Optional[int] = None
    l2_override: Optional[str] = None
    notes: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_canonical_map() -> dict:
    """Return {l2_category: canonical_id} using first row per l2."""
    rows = query(
        """
        SELECT DISTINCT ON (l2_category) l2_category, canonical_id
        FROM dim_canonical_account
        ORDER BY l2_category, sort_order
        """
    )
    return {r["l2_category"]: r["canonical_id"] for r in rows}


def _resolve_canonical_id(account_no: str, category: Optional[str], canonical_map: dict) -> Optional[int]:
    if account_no == "999999":
        return None
    l2 = None
    if category and category in _CATEGORY_TO_L2:
        l2 = _CATEGORY_TO_L2[category]
    else:
        prefix = str(account_no)[:1]
        l2 = _PREFIX_TO_L2.get(prefix)
    return canonical_map.get(l2) if l2 else None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/accounts")
def list_canonical_accounts(current: dict = Depends(require_auth)):
    """List all dim_canonical_account rows ordered by sort_order."""
    return query(
        """
        SELECT canonical_id, l1_statement, l2_category, l3_subcategory,
               display_name, sort_order, is_active
        FROM dim_canonical_account
        ORDER BY sort_order, canonical_id
        """
    )


@router.get("/mappings")
def list_mappings(
    source_erp: str = Query(default="BC"),
    current: dict = Depends(require_auth),
):
    """List account_mapping rows for current tenant + ERP, joined with canonical."""
    tenant_id = current["tenant_id"]
    return query(
        """
        SELECT am.mapping_id, am.source_erp, am.source_account, am.source_name,
               am.canonical_id, am.l2_override, am.mapped_by, am.confidence, am.notes,
               am.created_at, am.updated_at,
               dca.l1_statement, dca.l2_category, dca.l3_subcategory, dca.display_name
        FROM account_mapping am
        LEFT JOIN dim_canonical_account dca ON dca.canonical_id = am.canonical_id
        WHERE am.tenant_id = %s AND am.source_erp = %s
        ORDER BY am.source_account
        """,
        (tenant_id, source_erp),
    )


@router.put("/mappings/{source_account}")
def update_mapping(
    source_account: str,
    body: MappingUpdate,
    source_erp: str = Query(default="BC"),
    current: dict = Depends(require_auth),
):
    """User-override a mapping. Sets mapped_by='user'."""
    tenant_id = current["tenant_id"]

    # Verify row exists
    existing = query(
        "SELECT mapping_id FROM account_mapping WHERE tenant_id=%s AND source_erp=%s AND source_account=%s",
        (tenant_id, source_erp, source_account),
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Mapping not found for this account/erp/tenant")

    updates = ["mapped_by = 'user'", "updated_at = NOW()"]
    params: list = []

    if body.canonical_id is not None:
        updates.append("canonical_id = %s")
        params.append(body.canonical_id)
    if body.l2_override is not None:
        updates.append("l2_override = %s")
        params.append(body.l2_override)
    if body.notes is not None:
        updates.append("notes = %s")
        params.append(body.notes)

    params.extend([tenant_id, source_erp, source_account])
    rows = query(
        f"""
        UPDATE account_mapping
           SET {', '.join(updates)}
         WHERE tenant_id = %s AND source_erp = %s AND source_account = %s
         RETURNING mapping_id, source_account, canonical_id, l2_override, mapped_by, notes, updated_at
        """,
        params,
    )
    return rows[0] if rows else {}


@router.post("/mappings/auto-map")
def auto_map(
    source_erp: str = Query(default="BC"),
    current: dict = Depends(require_auth),
):
    """Re-run auto-mapping for all accounts that are currently unmapped (mapped_by='auto', canonical_id IS NULL)."""
    tenant_id = current["tenant_id"]

    # Fetch unmapped auto rows
    unmapped = query(
        """
        SELECT am.source_account, da.account_category
        FROM account_mapping am
        LEFT JOIN dim_account da ON da.account_no = am.source_account
        WHERE am.tenant_id = %s AND am.source_erp = %s
          AND am.mapped_by = 'auto' AND am.canonical_id IS NULL
        """,
        (tenant_id, source_erp),
    )

    if not unmapped:
        return {"updated": 0, "message": "No unmapped auto accounts found"}

    canonical_map = _get_canonical_map()
    updated = 0
    for row in unmapped:
        cid = _resolve_canonical_id(row["source_account"], row.get("account_category"), canonical_map)
        if cid:
            query(
                """
                UPDATE account_mapping
                   SET canonical_id = %s,
                       confidence   = 60.0,
                       updated_at   = NOW()
                 WHERE tenant_id = %s AND source_erp = %s AND source_account = %s
                """,
                (cid, tenant_id, source_erp, row["source_account"]),
            )
            updated += 1

    return {"updated": updated, "total_unmapped_before": len(unmapped)}


@router.get("/stats")
def get_stats(
    source_erp: str = Query(default="BC"),
    current: dict = Depends(require_auth),
):
    """Coverage stats: total, mapped, unmapped, pct_mapped, by_l1, by_erp."""
    tenant_id = current["tenant_id"]

    totals = query(
        """
        SELECT
            COUNT(*) AS total,
            COUNT(canonical_id) AS mapped
        FROM account_mapping
        WHERE tenant_id = %s AND source_erp = %s
        """,
        (tenant_id, source_erp),
    )
    total  = int(totals[0]["total"])  if totals else 0
    mapped = int(totals[0]["mapped"]) if totals else 0
    unmapped   = total - mapped
    pct_mapped = round(mapped / total * 100, 1) if total > 0 else 0.0

    # by_l1 — count of mapped accounts per L1 statement
    by_l1_rows = query(
        """
        SELECT dca.l1_statement, COUNT(*) AS cnt
        FROM account_mapping am
        JOIN dim_canonical_account dca ON dca.canonical_id = am.canonical_id
        WHERE am.tenant_id = %s AND am.source_erp = %s
        GROUP BY dca.l1_statement
        """,
        (tenant_id, source_erp),
    )
    by_l1 = {r["l1_statement"]: int(r["cnt"]) for r in by_l1_rows}

    # by_erp — distinct source_erp counts
    by_erp_rows = query(
        """
        SELECT source_erp, COUNT(DISTINCT source_account) AS cnt
        FROM account_mapping
        WHERE tenant_id = %s
        GROUP BY source_erp
        """,
        (tenant_id,),
    )
    by_erp = {r["source_erp"]: int(r["cnt"]) for r in by_erp_rows}

    return {
        "total":      total,
        "mapped":     mapped,
        "unmapped":   unmapped,
        "pct_mapped": pct_mapped,
        "by_l1":      by_l1,
        "by_erp":     by_erp,
    }


@router.get("/erp-types")
def get_erp_types(current: dict = Depends(require_auth)):
    """List distinct source_erp values present in account_mapping for this tenant."""
    tenant_id = current["tenant_id"]
    rows = query(
        """
        SELECT DISTINCT source_erp
        FROM account_mapping
        WHERE tenant_id = %s
        ORDER BY source_erp
        """,
        (tenant_id,),
    )
    return [r["source_erp"] for r in rows]
