"""
api/main.py — FastAPI application entry point.

Run with:
    uvicorn api.main:app --reload --port 8000

Endpoints:
    POST   /api/certs/issue
    GET    /api/certs/{serial}
    GET    /api/certs/
    POST   /api/certs/verify
    POST   /api/certs/revoke
    GET    /api/crl
    GET    /api/audit
    POST   /ocsp          (OCSP responder)
    POST   /acme/order
    GET    /acme/challenge/{token}
    POST   /acme/finalize/{order_id}
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from db.database import init_db, get_db
from db.models import User
from api.routes import certs, crl, audit, ocsp, acme, ca, dashboard, policy, requests, auth, settings
from automation.scheduler import start_scheduler, stop_scheduler
from sqlalchemy.orm import Session


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Seed default users
    db: Session = next(get_db())
    try:
        from api.routes.auth import seed_default_users
        seed_default_users(db)
    finally:
        db.close()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Digital Certificate Authority API",
    description="PKI prototype — RSA-2048 · X.509 v3 · SHA-256 · OCSP · ACME",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/auth",      tags=["Auth"])
app.include_router(ca.router,        prefix="/api/ca",        tags=["CA"])
app.include_router(certs.router,     prefix="/api/certs",     tags=["Certificates"])
app.include_router(crl.router,       prefix="/api",           tags=["CRL"])
app.include_router(audit.router,     prefix="/api",           tags=["Audit"])
app.include_router(ocsp.router,      prefix="",               tags=["OCSP"])
app.include_router(acme.router,      prefix="/acme",          tags=["ACME"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(policy.router,    prefix="/api/policy",    tags=["Policy"])
app.include_router(requests.router,  prefix="/api/requests",  tags=["Requests"])
app.include_router(settings.router,  prefix="/api/settings",  tags=["Settings"])


@app.get("/", tags=["Health"])
def health():
    return {"status": "ok", "service": "Digital Certificate Authority", "version": "2.0.0"}
