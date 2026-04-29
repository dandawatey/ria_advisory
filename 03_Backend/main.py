"""
UFIP FastAPI Backend
Runs on http://localhost:8000
Docs at   http://localhost:8000/docs
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import dashboard, entities, gl, analytics, insights, reports, settings, auth, tenants, budgets, investments

app = FastAPI(
    title="UFIP API",
    description="Unified Financial Intelligence Platform — RIA Advisory",
    version="1.0.0",
)

# Allow origins: comma-separated ALLOWED_ORIGINS env var overrides defaults
_DEFAULT_ORIGINS = [
    "https://i-finsights.netlify.app",
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4000", "http://127.0.0.1:4000",
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


@app.get("/health")
def health():
    return {"status": "ok", "service": "ufip-api"}
