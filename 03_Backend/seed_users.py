"""
Seed test users for all roles.
Run inside the API container or with correct PGHOST/PGDATABASE env:
    python seed_users.py

Idempotent — skips existing users.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import query
from auth_utils import hash_password

USERS = [
    {
        "email":        "admin@ria-advisory.com",
        "password":     "Admin@2026",
        "display_name": "RIA Super Admin",
        "tenant_slug":  "ria-advisory",
        "role":         "superadmin",
    },
    {
        "email":        "admin@ria-admin.com",
        "password":     "Admin@2026",
        "display_name": "RIA Admin",
        "tenant_slug":  "ria-advisory",
        "role":         "ria_admin",
    },
    {
        "email":        "admin@isource.com",
        "password":     "Admin@2026",
        "display_name": "iSource Admin",
        "tenant_slug":  "isource",
        "role":         "isource_admin",
    },
]


def seed():
    for u in USERS:
        existing = query("SELECT id FROM users WHERE email=%s", (u["email"],))
        if existing:
            print(f"  skip  {u['email']} (exists)")
            continue

        rows = query("SELECT id FROM tenants WHERE slug=%s", (u["tenant_slug"],))
        if not rows:
            print(f"  ERROR tenant '{u['tenant_slug']}' not found — run migrations first")
            continue
        tid = str(rows[0]["id"])

        query(
            "INSERT INTO users (email, password_hash, display_name, tenant_id, role) VALUES (%s,%s,%s,%s,%s)",
            (u["email"], hash_password(u["password"]), u["display_name"], tid, u["role"]),
        )
        print(f"  created {u['role']:20s}  {u['email']}")

    print("done")


if __name__ == "__main__":
    seed()
