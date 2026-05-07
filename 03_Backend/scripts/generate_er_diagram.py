#!/usr/bin/env python3
"""
IC-51 — ER Diagram Generator (Living Document)
Introspects live PostgreSQL schema and regenerates 00_docs/07_ER_Diagram.md.

Usage:
  python3 03_Backend/scripts/generate_er_diagram.py

Run from repo root. Uses PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD env vars.
Idempotent — running twice produces identical output.
"""

import os
import sys
from datetime import date
from pathlib import Path
from textwrap import indent

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# ── Paths ──────────────────────────────────────────────────────────────────────
REPO_ROOT  = Path(__file__).resolve().parent.parent.parent
ER_DOC     = REPO_ROOT / "00_docs" / "07_ER_Diagram.md"
ENV_FILE   = REPO_ROOT / "03_Backend" / ".env"

load_dotenv(ENV_FILE)
load_dotenv()  # also pick up shell env

# ── Domain map ────────────────────────────────────────────────────────────────
# Determines section headings in the Mermaid block and overview table.
DOMAIN_MAP = {
    "Auth & Multi-Tenancy": [
        "tenants", "users", "casbin_rule", "impersonation_audit",
        "audit_logs", "app_settings",
    ],
    "Feature Flags": [
        "feature_flags", "tenant_feature_flags",
    ],
    "ERP Integration": [
        "dim_erp_source", "dim_erp_credential", "dim_erp_mapping",
        "tenant_bc_config", "fact_sync_log",
        "fact_connector_health_log", "fact_connector_alerts",
    ],
    "Financial Data — Star Schema": [
        "fact_gl_entries", "fact_posted_sales", "fact_coa_balances",
        "dim_account", "dim_bal_account", "dim_company", "dim_date",
        "dim_document", "dim_department", "dim_currency",
        "dim_counterparty", "dim_posting_group", "dim_project",
        "dim_project_code", "dim_geo", "dim_customer",
    ],
    "Canonical CoA Model": [
        "dim_canonical_account", "account_mapping",
        "fact_gl_normalized", "fact_gl_quarantine",
    ],
    "Planning & Portfolio": [
        "budgets", "investments",
    ],
    "Configuration & RBAC": [
        "account_groups", "account_group_members",
        "dim_dimension_hierarchy", "dim_exchange_rate",
    ],
    "System": [
        "schema_migrations",
    ],
}


# ── DB helpers ─────────────────────────────────────────────────────────────────

def connect():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "ria_advisory"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", ""),
    )


def fetch_tables(cur):
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    return [r[0] for r in cur.fetchall()]


def fetch_columns(cur):
    """Returns {table_name: [(col_name, mermaid_type, nullable, is_pk)]}"""
    cur.execute("""
        SELECT
            c.table_name,
            c.column_name,
            c.data_type,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            c.is_nullable,
            c.column_default,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_pk
        FROM information_schema.columns c
        LEFT JOIN (
            SELECT kcu.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = 'public'
        ) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position
    """)
    result = {}
    for row in cur.fetchall():
        tbl, col, dtype, char_len, num_prec, num_scale, nullable, default, is_pk = row
        mtype = _mermaid_type(dtype, char_len, num_prec, num_scale, col, default)
        result.setdefault(tbl, []).append((col, mtype, nullable == "YES", is_pk))
    return result


def fetch_fks(cur):
    """Returns list of (from_table, from_col, to_table, to_col)."""
    cur.execute("""
        SELECT DISTINCT
            kcu.table_name  AS from_table,
            kcu.column_name AS from_col,
            ccu.table_name  AS to_table,
            ccu.column_name AS to_col
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY kcu.table_name, kcu.column_name
    """)
    return cur.fetchall()


# ── Type mapping ───────────────────────────────────────────────────────────────

def _mermaid_type(dtype, char_len, num_prec, num_scale, col_name, default):
    dtype = dtype.lower()
    if dtype in ("uuid",):
        return "UUID"
    if dtype in ("boolean",):
        return "boolean"
    if dtype in ("integer", "int", "int4", "int2", "smallint"):
        return "int"
    if dtype in ("bigint", "int8"):
        return "bigint"
    if dtype in ("serial", "bigserial"):
        return "serial"
    if dtype in ("numeric", "decimal"):
        if num_prec and num_scale is not None:
            return f"decimal({num_prec},{num_scale})"
        return "decimal"
    if dtype in ("double precision", "float8", "real", "float4"):
        return "float"
    if dtype in ("character varying", "varchar"):
        return f"varchar({char_len})" if char_len else "varchar"
    if dtype == "text":
        return "text"
    if dtype in ("timestamp without time zone", "timestamp with time zone",
                 "timestamptz", "timestamp"):
        return "timestamp"
    if dtype == "date":
        return "date"
    if dtype in ("jsonb", "json"):
        return "jsonb"
    if dtype == "bytea":
        return "bytea"
    return dtype.replace(" ", "_")


# ── Mermaid block builder ──────────────────────────────────────────────────────

def build_mermaid(tables, columns, fks):
    lines = ["```mermaid", "erDiagram"]

    # Domain ordering: known domains first, then any uncategorised
    all_known = {t for grp in DOMAIN_MAP.values() for t in grp}
    uncategorised = [t for t in sorted(tables) if t not in all_known]

    domain_order = list(DOMAIN_MAP.items())
    if uncategorised:
        domain_order.append(("Uncategorised", uncategorised))

    for domain_name, domain_tables in domain_order:
        present = [t for t in domain_tables if t in tables]
        if not present:
            continue
        lines.append(f"\n    %% {'='*20} {domain_name.upper()} {'='*20}")
        for tbl in present:
            cols = columns.get(tbl, [])
            lines.append(f"\n    {tbl} {{")
            for col_name, col_type, nullable, is_pk in cols:
                pk_marker = " PK" if is_pk else ("" if not nullable else "")
                null_marker = "" if not nullable else ""
                lines.append(f"        {col_type} {col_name}{pk_marker}")
            lines.append("    }")

    # FK relationships
    lines.append("\n    %% ==================== RELATIONSHIPS ====================")

    # Deduplicate: one edge per (from_table, to_table) pair
    seen = set()
    for from_tbl, from_col, to_tbl, to_col in sorted(fks):
        key = (from_tbl, to_tbl)
        if key in seen:
            continue
        seen.add(key)
        label = from_col.replace("_id", "").replace("_", " ")
        lines.append(f'    {to_tbl} ||--o{{ {from_tbl} : "{label}"')

    lines.append("```")
    return "\n".join(lines)


# ── Document sections ──────────────────────────────────────────────────────────

def build_overview(tables, fks, today):
    domain_lines = []
    all_known = {t for grp in DOMAIN_MAP.values() for t in grp}
    for domain_name, domain_tables in DOMAIN_MAP.items():
        present = [t for t in domain_tables if t in tables]
        if not present:
            continue
        domain_lines.append(f"### Domain: {domain_name}")
        domain_lines.append("Tables: " + ", ".join(f"`{t}`" for t in present))
        domain_lines.append("")

    uncategorised = [t for t in sorted(tables) if t not in all_known]
    if uncategorised:
        domain_lines.append("### Domain: Uncategorised")
        domain_lines.append("Tables: " + ", ".join(f"`{t}`" for t in uncategorised))
        domain_lines.append("")

    fk_count = len(set((f, t) for f, fc, t, _ in fks))
    overview = (
        f"{len(tables)} tables organised into {len(DOMAIN_MAP)} domains. "
        f"Core star schema centred on `fact_gl_entries`. "
        f"Multi-tenant isolation via `tenant_id UUID` on all client-data tables. "
        f"{fk_count} FK constraints."
    )

    return overview, "\n".join(domain_lines)


def build_document(tables, columns, fks, today):
    overview, domain_section = build_overview(tables, fks, today)
    mermaid = build_mermaid(set(tables), columns, fks)

    return f"""# 07 — Entity Relationship Diagram
**Status:** Active — Living Document
**Owner:** Kiran_Data_008
**Last Updated:** {today}
**Source:** ria_advisory PostgreSQL database (live schema query)

---

## Overview

{overview}

---

## Domain Groups

{domain_section}
---

## Mermaid ER Diagram

{mermaid}

---

## Update Log

### Updated {today}
Auto-generated by `03_Backend/scripts/generate_er_diagram.py`.
Tables: {len(tables)} | FK relationships: {len(set((f,t) for f,fc,t,_ in fks))} | Migrations applied: 001–011
"""


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    today = str(date.today())
    print(f"[IC-51] Generating ER diagram — {today}")

    conn = connect()
    cur  = conn.cursor()

    tables  = fetch_tables(cur)
    columns = fetch_columns(cur)
    fks     = fetch_fks(cur)

    print(f"  Tables:  {len(tables)}")
    print(f"  Columns: {sum(len(v) for v in columns.values())}")
    print(f"  FKs:     {len(fks)}")

    # Check if existing doc has a previous update log — preserve it
    existing_update_log = ""
    if ER_DOC.exists():
        content = ER_DOC.read_text()
        if "## Update Log" in content:
            # Grab everything after the first update log entry we're about to write
            # (we rebuild the full log each time to avoid duplication)
            pass  # full rebuild is idempotent

    doc = build_document(tables, columns, fks, today)
    ER_DOC.write_text(doc, encoding="utf-8")

    print(f"  Written: {ER_DOC}")
    conn.close()


if __name__ == "__main__":
    main()
