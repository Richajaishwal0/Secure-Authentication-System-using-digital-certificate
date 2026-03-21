"""
api/routes/certs.py — Certificate lifecycle endpoints.

POST   /api/certs/issue          Issue a new certificate
GET    /api/certs/               List all issued certificates
GET    /api/certs/{serial}       Get certificate details by serial
POST   /api/certs/verify         Verify a certificate (PEM body)
POST   /api/certs/revoke         Revoke a certificate by serial
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional

from db.database import get_db
from db.models import Certificate, RevokedCert
from ca.ca_setup import CertificateAuthority
from ca.intermediate_ca import IntermediateCA
from ca.csr_generator import CSRGenerator
from ca.cert_issuer import CertificateIssuer
from ca.cert_verifier import CertificateVerifier
from ca.crl_manager import CRLManager, REASON_MAP
from ca.cert_templates import TEMPLATES
from audit.audit_log import AuditLog
from integrations.ldap_client import LDAPClient
from config import CA_CONFIG
from logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class IssueRequest(BaseModel):
    name:          str
    email:         str
    org:           str           = "Example Corp"
    org_unit:      str           = "Engineering"
    country:       str           = "US"
    state:         str           = "California"
    locality:      str           = "San Francisco"
    days:          int           = 365
    template:      str           = "client_auth"
    san_names:     list[str]     = []
    use_intermediate: bool       = False
    ldap_lookup:   bool          = False    # look up identity from LDAP before issuing


class RevokeRequest(BaseModel):
    serial: str
    reason: str = "unspecified"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _bootstrap(db: Session):
    ca      = CertificateAuthority()
    ca_key, ca_cert = ca.initialize()
    audit   = AuditLog(CA_CONFIG["audit_log_path"])
    crl_mgr = CRLManager(ca_key, ca_cert, audit)
    return ca_key, ca_cert, audit, crl_mgr


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/issue")
def issue_certificate(req: IssueRequest, db: Session = Depends(get_db)):
    if req.template not in TEMPLATES:
        raise HTTPException(400, f"Unknown template. Choose from: {list(TEMPLATES)}")
    if req.reason if hasattr(req, "reason") else False:
        pass

    ca_key, ca_cert, audit, crl_mgr = _bootstrap(db)

    # Optional LDAP identity verification
    if req.ldap_lookup:
        ldap = LDAPClient()
        user = ldap.lookup_user(req.email)
        if not user:
            raise HTTPException(404, f"User '{req.email}' not found in LDAP directory.")

    subject = {
        "common_name": req.name,
        "email":       req.email,
        "org":         req.org,
        "org_unit":    req.org_unit,
        "country":     req.country,
        "state":       req.state,
        "locality":    req.locality,
    }

    gen  = CSRGenerator(subject)
    key  = gen.generate_key_pair()
    csr  = gen.build_csr(key)
    safe = req.name.lower().replace(" ", "_")
    gen.save(key, csr, name=safe)

    if req.use_intermediate:
        int_ca = IntermediateCA(ca_key, ca_cert, audit)
        int_ca.initialize()
        cert = int_ca.issue(csr, req.days, safe, req.template, req.san_names or None)
        issued_by = "intermediate"
    else:
        issuer = CertificateIssuer(ca_key, ca_cert, audit, db=db)
        cert   = issuer.issue(csr, req.days, safe, req.template, req.san_names or None)
        issued_by = "root"

    return {
        "serial":     str(cert.serial_number),
        "subject":    cert.subject.rfc4514_string(),
        "template":   req.template,
        "issued_by":  issued_by,
        "not_before": cert.not_valid_before_utc.isoformat(),
        "not_after":  cert.not_valid_after_utc.isoformat(),
        "pem":        cert.public_bytes(__import__(
                          "cryptography.hazmat.primitives.serialization",
                          fromlist=["Encoding"]).Encoding.PEM).decode(),
    }


@router.get("/")
def list_certificates(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    certs = db.query(Certificate).offset(skip).limit(limit).all()
    return [
        {
            "serial":      c.serial,
            "common_name": c.common_name,
            "email":       c.email,
            "template":    c.template,
            "issued_by":   c.issued_by,
            "not_after":   c.not_after.isoformat() if c.not_after else None,
            "revoked":     c.revocation is not None,
        }
        for c in certs
    ]


@router.get("/{serial}")
def get_certificate(serial: str, db: Session = Depends(get_db)):
    cert = db.query(Certificate).filter(Certificate.serial == serial).first()
    if not cert:
        raise HTTPException(404, "Certificate not found.")
    return {
        "serial":      cert.serial,
        "common_name": cert.common_name,
        "email":       cert.email,
        "org":         cert.org,
        "template":    cert.template,
        "issued_by":   cert.issued_by,
        "not_before":  cert.not_before.isoformat() if cert.not_before else None,
        "not_after":   cert.not_after.isoformat() if cert.not_after else None,
        "revoked":     cert.revocation is not None,
        "revocation":  {
            "reason":     cert.revocation.reason,
            "revoked_at": cert.revocation.revoked_at.isoformat(),
        } if cert.revocation else None,
        "pem":         cert.pem,
    }


@router.post("/verify")
async def verify_certificate(file: UploadFile = File(...), db: Session = Depends(get_db)):
    pem_bytes = await file.read()
    from cryptography import x509 as _x509
    try:
        cert = _x509.load_pem_x509_certificate(pem_bytes)
    except Exception:
        raise HTTPException(400, "Invalid PEM certificate.")

    ca_key, ca_cert, audit, crl_mgr = _bootstrap(db)
    verifier = CertificateVerifier(ca_cert, crl_mgr, audit)
    result   = verifier.verify(cert)

    return {
        "valid":   result.valid,
        "serial":  str(result.serial),
        "subject": result.subject,
        "checks":  result.checks,
        "reason":  result.reason,
    }


@router.post("/revoke")
def revoke_certificate(req: RevokeRequest, db: Session = Depends(get_db)):
    if req.reason not in REASON_MAP:
        raise HTTPException(400, f"Invalid reason. Choose from: {list(REASON_MAP)}")

    ca_key, ca_cert, audit, crl_mgr = _bootstrap(db)

    serial_int = int(req.serial)
    if crl_mgr.is_revoked(serial_int):
        raise HTTPException(409, "Certificate is already revoked.")

    crl_mgr.revoke(serial_int, reason=req.reason)

    # Also persist revocation in DB
    existing = db.query(RevokedCert).filter(RevokedCert.serial == req.serial).first()
    if not existing:
        db.add(RevokedCert(serial=req.serial, reason=req.reason))
        db.commit()

    return {"revoked": True, "serial": req.serial, "reason": req.reason}
