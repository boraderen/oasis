"""Application entrypoint."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .routers import analysis, assets, auth, dashboard
from .storage import ensure_storage


ensure_storage()
init_db()

app = FastAPI(title=settings.app_name, version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(assets.router)
app.include_router(analysis.router)
app.include_router(dashboard.router)


@app.get("/")
def root() -> dict:
    """Health and welcome response."""
    return {"message": "Oasis API is running", "status": "success"}
