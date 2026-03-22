"""
api/routes/requests.py — Self-service certificate request and admin approval queue.

POST /api/requests/          — user submits a cert request (no CA knowledge needed)
GET  /api/requests/          — admin lists all pending/approved/rejected requests
GET  /api/requests/{id}      — get a single request
POST /api/requests/{id}/approve — admin approves → cert auto-issued
POST /api/requests/{id}/reject  — admin rejects with reason
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from db.database import get_db
from db.models import CertRequest, CertPolicy, Certificate, RevokedCert
from ca.ca_setup import CertificateAuthority
from ca.csr_generator import CSRGenerator
from ca.cert_issuer import CertificateIssuer
from audit.audit_log import AuditLog
from config import CA_CONFIG

router = APIRouter()


class RequestIn(BaseModel):
    common_name: str
    email:       str
    org:         str = ""
    org_unit:    str = ""
    country:     str = "US"
    state:       str = ""
    locality:    str = ""
    template:    str = "client_auth"
    san_names:   list[str] = []
    purpose:     str = ""       # plain-English reason — "for VPN access", etc.


class RejectIn(BaseModel):
    reason: str


@router.post("/")
def submit_request(body: RequestIn, db: Session = Depends(get_db)):
    policy = db.query(CertPolicy).filter(CertPolicy.template == body.template).first()
    auto_approve = policy is not None and policy.require_approval == False

    req = CertRequest(
        common_name = body.common_name,
        email       = body.email,
        org         = body.org,
        org_unit    = body.org_unit,
        country     = body.country,
        state       = body.state,
        locality    = body.locality,
        template    = body.template,
        san_names   = ",".join(body.san_names),
        purpose     = body.purpose,
        status      = "approved" if auto_approve else "pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    issued_serial = None
    key_pem = None
    if auto_approve:
        issued_serial, key_pem = _issue_for_request(db, req, policy)

    return {
        "id":              req.id,
        "status":          req.status,
        "auto_approved":   auto_approve,
        "cert_serial":     issued_serial,
        "private_key_pem": key_pem,
    }


@router.get("/")
def list_requests(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(CertRequest)
    if status:
        q = q.filter(CertRequest.status == status)
    reqs = q.order_by(CertRequest.created_at.desc()).all()
    return [_serialize(r) for r in reqs]


@router.get("/{req_id}")
def get_request(req_id: int, db: Session = Depends(get_db)):
    req = db.query(CertRequest).filter(CertRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Request not found.")
    return _serialize(req)


@router.post("/{req_id}/approve")
def approve_request(req_id: int, db: Session = Depends(get_db)):
    req = db.query(CertRequest).filter(CertRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Request not found.")
    if req.status != "pending":
        raise HTTPException(409, f"Request is already '{req.status}'.")

    req.status = "approved"
    req.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    policy = db.query(CertPolicy).filter(CertPolicy.template == req.template).first()
    serial, key_pem = _issue_for_request(db, req, policy)

    cert_row = db.query(Certificate).filter(Certificate.serial == serial).first()
    return {
        "approved":        True,
        "cert_serial":     serial,
        "cert_pem":        cert_row.pem if cert_row else None,
        "private_key_pem": key_pem,
        "not_after":       cert_row.not_after.isoformat() if cert_row and cert_row.not_after else None,
        "recipient_name":  req.common_name,
        "recipient_email": req.email,
        "template":        req.template,
    }


@router.post("/{req_id}/reject")
def reject_request(req_id: int, body: RejectIn, db: Session = Depends(get_db)):
    req = db.query(CertRequest).filter(CertRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Request not found.")
    if req.status != "pending":
        raise HTTPException(409, f"Request is already '{req.status}'.")

    req.status = "rejected"
    req.reject_reason = body.reason
    req.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return {"rejected": True, "reason": body.reason}


# ── Internal ───────────────────────────────────────────────────────────────────

def _issue_for_request(db: Session, req: CertRequest, policy) -> tuple[str, str | None]:
    ca = CertificateAuthority()
    ca_key, ca_cert = ca.initialize()
    audit = AuditLog(CA_CONFIG["audit_log_path"])

    subject = {
        "common_name": req.common_name,
        "email":       req.email,
        "org":         req.org or "",
        "org_unit":    req.org_unit or "",
        "country":     req.country or "US",
        "state":       req.state or "",
        "locality":    req.locality or "",
    }
    safe_name = req.common_name.lower().replace(" ", "_")
    gen = CSRGenerator(subject)
    key = gen.generate_key_pair()
    csr = gen.build_csr(key)
    gen.save(key, csr, name=safe_name)

    validity = policy.max_validity_days if (policy and policy.max_validity_days and policy.max_validity_days >= 30) else 365
    san_list = [s for s in (req.san_names or "").split(",") if s]

    issuer = CertificateIssuer(ca_key, ca_cert, audit, db=db)
    cert = issuer.issue(csr, validity, safe_name, req.template, san_list or None, private_key=key)

    from cryptography.hazmat.primitives import serialization as _ser
    key_pem = key.private_bytes(
        _ser.Encoding.PEM,
        _ser.PrivateFormat.TraditionalOpenSSL,
        _ser.NoEncryption(),
    ).decode()

    req.issued_serial = str(cert.serial_number)
    db.commit()
    return str(cert.serial_number), key_pem


def _serialize(r: CertRequest):
    return {
        "id":            r.id,
        "common_name":   r.common_name,
        "email":         r.email,
        "org":           r.org,
        "org_unit":      r.org_unit,
        "country":       r.country,
        "template":      r.template,
        "san_names":     r.san_names,
        "purpose":       r.purpose,
        "status":        r.status,
        "reject_reason": r.reject_reason,
        "issued_serial": r.issued_serial,
        "created_at":    r.created_at.isoformat() if r.created_at else None,
        "reviewed_at":   r.reviewed_at.isoformat() if r.reviewed_at else None,
    }
