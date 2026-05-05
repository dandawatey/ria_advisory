"""
account_groups.py — User-defined GL account group endpoints
GET/POST/PUT/DELETE /api/gl/groups
POST/DELETE /api/gl/groups/{id}/members
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import query
from auth_utils import require_auth

router = APIRouter(prefix="/api/gl/groups", tags=["account-groups"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class GroupCreate(BaseModel):
    group_name: str
    description: Optional[str] = None
    color: Optional[str] = "#6366f1"
    sort_order: Optional[int] = 0


class GroupUpdate(BaseModel):
    group_name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None


class MemberAdd(BaseModel):
    account_no: str
    label_override: Optional[str] = None


class MembersBulk(BaseModel):
    account_nos: List[str]


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_group(group_id: str, tenant_id: str):
    rows = query(
        "SELECT * FROM account_groups WHERE group_id = %s AND tenant_id = %s",
        (group_id, tenant_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Group not found")
    return rows[0]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_groups(current: dict = Depends(require_auth)):
    """List all account groups for the current tenant, with member count."""
    tenant_id = current["tenant_id"]
    return query(
        """
        SELECT ag.group_id, ag.group_name, ag.description, ag.color, ag.sort_order,
               ag.created_at,
               COUNT(agm.account_no) AS member_count
        FROM account_groups ag
        LEFT JOIN account_group_members agm ON agm.group_id = ag.group_id
        WHERE ag.tenant_id = %s
        GROUP BY ag.group_id, ag.group_name, ag.description, ag.color, ag.sort_order, ag.created_at
        ORDER BY ag.sort_order, ag.group_name
        """,
        (tenant_id,),
    )


@router.post("", status_code=201)
def create_group(body: GroupCreate, current: dict = Depends(require_auth)):
    tenant_id = current["tenant_id"]
    rows = query(
        """
        INSERT INTO account_groups (tenant_id, group_name, description, color, sort_order)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING group_id, group_name, description, color, sort_order, created_at
        """,
        (tenant_id, body.group_name, body.description, body.color, body.sort_order),
    )
    if not rows:
        raise HTTPException(status_code=400, detail="Could not create group (name may already exist)")
    return rows[0]


@router.put("/{group_id}")
def update_group(group_id: str, body: GroupUpdate, current: dict = Depends(require_auth)):
    tenant_id = current["tenant_id"]
    _get_group(group_id, tenant_id)  # 404 if missing

    updates, params = [], []
    if body.group_name is not None:
        updates.append("group_name = %s"); params.append(body.group_name)
    if body.description is not None:
        updates.append("description = %s"); params.append(body.description)
    if body.color is not None:
        updates.append("color = %s"); params.append(body.color)
    if body.sort_order is not None:
        updates.append("sort_order = %s"); params.append(body.sort_order)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    updates.append("updated_at = NOW()")
    params.extend([group_id, tenant_id])
    rows = query(
        f"UPDATE account_groups SET {', '.join(updates)} WHERE group_id = %s AND tenant_id = %s RETURNING *",
        params,
    )
    return rows[0] if rows else {}


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: str, current: dict = Depends(require_auth)):
    tenant_id = current["tenant_id"]
    _get_group(group_id, tenant_id)
    # CASCADE deletes members
    query("DELETE FROM account_groups WHERE group_id = %s AND tenant_id = %s", (group_id, tenant_id))


# ── Members ───────────────────────────────────────────────────────────────────

@router.get("/{group_id}/members")
def list_members(group_id: str, current: dict = Depends(require_auth)):
    tenant_id = current["tenant_id"]
    _get_group(group_id, tenant_id)
    return query(
        """
        SELECT agm.account_no, agm.label_override, agm.added_at,
               da.account_name, da.account_category
        FROM account_group_members agm
        LEFT JOIN dim_account da ON da.account_no = agm.account_no
        WHERE agm.group_id = %s
        ORDER BY agm.account_no
        """,
        (group_id,),
    )


@router.post("/{group_id}/members", status_code=201)
def add_member(group_id: str, body: MemberAdd, current: dict = Depends(require_auth)):
    tenant_id = current["tenant_id"]
    _get_group(group_id, tenant_id)
    query(
        """
        INSERT INTO account_group_members (group_id, account_no, label_override)
        VALUES (%s, %s, %s)
        ON CONFLICT (group_id, account_no) DO UPDATE SET label_override = EXCLUDED.label_override
        """,
        (group_id, body.account_no, body.label_override),
    )
    return {"group_id": group_id, "account_no": body.account_no}


@router.post("/{group_id}/members/bulk", status_code=201)
def add_members_bulk(group_id: str, body: MembersBulk, current: dict = Depends(require_auth)):
    """Add multiple accounts to a group at once."""
    tenant_id = current["tenant_id"]
    _get_group(group_id, tenant_id)
    for acct in body.account_nos:
        query(
            "INSERT INTO account_group_members (group_id, account_no) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (group_id, acct),
        )
    return {"added": len(body.account_nos)}


@router.delete("/{group_id}/members/{account_no}", status_code=204)
def remove_member(group_id: str, account_no: str, current: dict = Depends(require_auth)):
    tenant_id = current["tenant_id"]
    _get_group(group_id, tenant_id)
    query(
        "DELETE FROM account_group_members WHERE group_id = %s AND account_no = %s",
        (group_id, account_no),
    )


# ── Available accounts (for picker) ───────────────────────────────────────────

@router.get("/{group_id}/available-accounts")
def available_accounts(group_id: str, current: dict = Depends(require_auth)):
    """Return all dim_account rows NOT yet in this group."""
    tenant_id = current["tenant_id"]
    _get_group(group_id, tenant_id)
    return query(
        """
        SELECT da.account_no, da.account_name, da.account_category
        FROM dim_account da
        WHERE da.account_no NOT IN (
            SELECT account_no FROM account_group_members WHERE group_id = %s
        )
        ORDER BY da.account_no
        """,
        (group_id,),
    )
