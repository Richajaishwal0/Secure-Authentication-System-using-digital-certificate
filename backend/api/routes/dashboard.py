"""
api/routes/dashboard.py — Trust dashboard and CA health endpoints.

GET /api/dashboard/stats     — cert counts, CA health summary
GET /api/dashboard/expiring  — certs expiring within N days
GET /api/dashboard/renewals  — recent auto-renewal log
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.database import get_db
from db.models import Certificate, RevokedCert, RenewalLog
from ca.ca_setup import CertificateAuthority

router = APIRouter()


def _now():
    """Return current UTC time as naive datetime — matches how SQLite stores it."""
    return datetime.utcnow()


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    now = _now()

    total   = db.query(Certificate).count()
    revoked = db.query(RevokedCert).count()

    active = (
        db.query(Certificate)
        .outerjoin(RevokedCert, Certificate.serial == RevokedCert.serial)
        .filter(RevokedCert.serial == None)  # noqa: E711
        .filter(Certificate.not_after > now)
        .count()
    )

    expired = (
        db.query(Certificate)
        .outerjoin(RevokedCert, Certificate.serial == RevokedCert.serial)
        .filter(RevokedCert.serial == None)  # noqa: E711
        .filter(Certificate.not_after <= now)
        .count()
    )

    expiring_soon = (
        db.query(Certificate)
        .outerjoin(RevokedCert, Certificate.serial == RevokedCert.serial)
        .filter(RevokedCert.serial == None)  # noqa: E711
        .filter(Certificate.not_after > now)
        .filter(Certificate.not_after <= now + timedelta(days=30))
        .count()
    )

    # CA health
    ca_info = None
    try:
        ca = CertificateAuthority()
        _, cert = ca.initialize()
        ca_expiry = cert.not_valid_after_utc.replace(tzinfo=None)  # make naive for comparison
        ca_days_left = (ca_expiry - now).days
        ca_info = {
            "subject":    cert.subject.rfc4514_string(),
            "not_after":  ca_expiry.isoformat(),
            "days_left":  ca_days_left,
            "healthy":    ca_days_left > 365,
        }
    except Exception:
        ca_info = {"healthy": False, "error": "CA not initialised"}

    return {
        "total":         total,
        "active":        active,
        "revoked":       revoked,
        "expired":       expired,
        "expiring_soon": expiring_soon,
        "ca":            ca_info,
    }


@router.get("/expiring")
def expiring_certs(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db)):
    now      = _now()
    deadline = now + timedelta(days=days)

    certs = (
        db.query(Certificate)
        .outerjoin(RevokedCert, Certificate.serial == RevokedCert.serial)
        .filter(RevokedCert.serial == None)  # noqa: E711
        .filter(Certificate.not_after > now)
        .filter(Certificate.not_after <= deadline)
        .order_by(Certificate.not_after.asc())
        .all()
    )

    return [
        {
            "serial":      c.serial,
            "common_name": c.common_name,
            "email":       c.email,
            "template":    c.template,
            "not_after":   c.not_after.isoformat() if c.not_after else None,
            "days_left":   (c.not_after - now).days if c.not_after else None,
        }
        for c in certs
    ]


@router.get("/renewals")
def renewal_log(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    logs = db.query(RenewalLog).order_by(RenewalLog.renewed_at.desc()).limit(limit).all()
    return [
        {
            "old_serial":  r.old_serial,
            "new_serial":  r.new_serial,
            "common_name": r.common_name,
            "trigger":     r.trigger,
            "renewed_at":  r.renewed_at.isoformat() if r.renewed_at else None,
        }
        for r in logs
    ]
