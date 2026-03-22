"""
api/routes/crl.py — CRL endpoints.

GET  /api/crl        Returns the current CRL as PEM text
POST /api/crl/rebuild  Force-rebuilds the CRL from the revocation registry
"""

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from db.database import get_db
from ca.ca_setup import CertificateAuthority
from ca.crl_manager import CRLManager
from audit.audit_log import AuditLog
from config import CA_CONFIG
from logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


def _crl_manager(db: Session) -> CRLManager:
    ca = CertificateAuthority()
    ca_key, ca_cert = ca.initialize()
    audit = AuditLog(CA_CONFIG["audit_log_path"])
    return CRLManager(ca_key, ca_cert, audit)


@router.get("/crl", response_class=PlainTextResponse)
def get_crl(db: Session = Depends(get_db)):
    """Return the current CRL as PEM text."""
    import os
    crl_path = CA_CONFIG["crl_dir"] + "\\ca.crl.pem"
    if not os.path.exists(crl_path):
        mgr = _crl_manager(db)
        mgr.build_and_save_crl()
    with open(crl_path, "r") as f:
        return f.read()


@router.post("/crl/rebuild")
def rebuild_crl(db: Session = Depends(get_db)):
    """Force-rebuild the CRL and return summary."""
    mgr = _crl_manager(db)
    crl = mgr.build_and_save_crl()
    revoked = list(crl)
    return {
        "rebuilt": True,
        "revoked_count": len(revoked),
        "entries": [
            {"serial": str(r.serial_number), "date": r.revocation_date_utc.isoformat()}
            for r in revoked
        ],
    }
