"""
UFIP FastAPI Backend
Runs on http://localhost:8000
Docs at   http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import dashboard, entities, gl

app = FastAPI(
    title="UFIP API",
    description="Unified Financial Intelligence Platform — RIA Advisory",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(entities.router)
app.include_router(gl.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ufip-api"}
