"""
UFIP FastAPI Backend
Runs on http://localhost:8000
Docs at   http://localhost:8000/docs
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from routers import dashboard, entities, gl, analytics, insights, reports, settings, auth, tenants, budgets, investments
from routers import erp_sources, mapping, freshness, cross_erp, consolidated, account_groups
from routers import rbac, canonical

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — initialise Casbin enforcer
    try:
        from casbin_enforcer import init_enforcer
        init_enforcer()
        logger.info("Casbin RBAC enforcer ready")
    except Exception as exc:
        logger.warning("Casbin enforcer init failed (non-fatal): %s", exc)
    yield
    # Shutdown — nothing to clean up


app = FastAPI(
    title="UFIP API",
    description="Unified Financial Intelligence Platform — RIA Advisory",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow origins: comma-separated ALLOWED_ORIGINS env var overrides defaults
_DEFAULT_ORIGINS = [
    # Production VM URL — set ALLOWED_ORIGINS env var on deployment server
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4000", "http://127.0.0.1:4000",
    "http://localhost:4001", "http://127.0.0.1:4001",
    "http://localhost:4002", "http://127.0.0.1:4002",
    "http://localhost:4003", "http://127.0.0.1:4003",
    "http://localhost:4004", "http://127.0.0.1:4004",
]
_env_origins = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins else _DEFAULT_ORIGINS
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tenants.router)
app.include_router(dashboard.router)
app.include_router(entities.router)
app.include_router(gl.router)
app.include_router(analytics.router)
app.include_router(insights.router)
app.include_router(reports.router)
app.include_router(settings.router)
app.include_router(budgets.router)
app.include_router(investments.router)
app.include_router(erp_sources.router)
app.include_router(mapping.router)
app.include_router(freshness.router)
app.include_router(cross_erp.router)
app.include_router(consolidated.router)
app.include_router(account_groups.router)
app.include_router(rbac.router)
app.include_router(canonical.router)


_STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(_STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ufip-api"}
