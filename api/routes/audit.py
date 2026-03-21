"""
api/routes/audit.py — Audit log endpoints.

GET  /api/audit          Return all audit log entries + chain integrity status
GET  /api/audit/verify   Verify chain integrity only (fast check)
"""

from fastapi import APIRouter
from audit.audit_log import AuditLog
from config import CA_CONFIG

router = APIRouter()


@router.get("/audit")
def get_audit_log():
    audit   = AuditLog(CA_CONFIG["audit_log_path"])
    intact  = audit.verify_chain()
    entries = audit.get_log()
    return {
        "chain_intact": intact,
        "entry_count":  len(entries),
        "entries":      entries,
    }


@router.get("/audit/verify")
def verify_audit_chain():
    audit  = AuditLog(CA_CONFIG["audit_log_path"])
    intact = audit.verify_chain()
    return {"chain_intact": intact}
