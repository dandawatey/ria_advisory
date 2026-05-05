"""
conftest.py — Adds 03_Backend to sys.path so tests can import routers, workers, services.
"""
import sys
import os

# Allow: from workers.bc_sync_worker import ..., from database import query, etc.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "03_Backend"))
