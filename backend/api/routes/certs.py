"""
api/routes/certs.py — Certificate lifecycle endpoints.

POST   /api/certs/issue          Issue a new certificate
GET    /api/certs/               List all issued certificates
GET    /api/certs/{serial}       Get certificate details by serial
POST   /api/certs/verify         Verify a certificate (PEM body)
POST   /api/certs/revoke         Revoke a certificate by serial
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
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
    if len(req.country) != 2:
        raise HTTPException(400, "Country must be exactly 2 letters (e.g. US, IN, GB).")

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
        int_ca = IntermediateCA(ca_key, ca_cert, audit, db=db)
        int_ca.initialize()
        cert = int_ca.issue(csr, req.days, safe, req.template, req.san_names or None, private_key=key)
        issued_by = "intermediate"
    else:
        issuer = CertificateIssuer(ca_key, ca_cert, audit, db=db)
        cert   = issuer.issue(csr, req.days, safe, req.template, req.san_names or None, private_key=key)
        issued_by = "root"

    from cryptography.hazmat.primitives import serialization as _ser
    key_pem = key.private_bytes(
        _ser.Encoding.PEM,
        _ser.PrivateFormat.TraditionalOpenSSL,
        _ser.NoEncryption(),
    ).decode()

    return {
        "serial":          str(cert.serial_number),
        "subject":         cert.subject.rfc4514_string(),
        "template":        req.template,
        "issued_by":       issued_by,
        "not_before":      cert.not_valid_before_utc.isoformat(),
        "not_after":       cert.not_valid_after_utc.isoformat(),
        "pem":             cert.public_bytes(__import__(
                               "cryptography.hazmat.primitives.serialization",
                               fromlist=["Encoding"]).Encoding.PEM).decode(),
        "private_key_pem": key_pem,
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
        "serial":          cert.serial,
        "common_name":     cert.common_name,
        "email":           cert.email,
        "org":             cert.org,
        "template":        cert.template,
        "issued_by":       cert.issued_by,
        "not_before":      cert.not_before.isoformat() if cert.not_before else None,
        "not_after":       cert.not_after.isoformat() if cert.not_after else None,
        "revoked":         cert.revocation is not None,
        "revocation":  {
            "reason":     cert.revocation.reason,
            "revoked_at": cert.revocation.revoked_at.isoformat(),
        } if cert.revocation else None,
        "pem":             cert.pem,
        "private_key_pem": cert.private_key_pem,
    }


@router.get("/{serial}/download/p12")
def download_p12(serial: str, password: str = Query(default="changeme"), db: Session = Depends(get_db)):
    """
    Generate and return a PKCS#12 (.p12) bundle containing the certificate
    and private key, protected by a user-supplied password.
    This is the standard format for importing into browsers, VPN clients,
    email clients (Outlook, Thunderbird), and Windows/macOS certificate stores.
    """
    cert_row = db.query(Certificate).filter(Certificate.serial == serial).first()
    if not cert_row:
        raise HTTPException(404, "Certificate not found.")
    if not cert_row.private_key_pem:
        raise HTTPException(409, "Private key not available for this certificate.")
    if cert_row.revocation is not None:
        raise HTTPException(409, "Cannot export a revoked certificate.")

    from cryptography import x509 as _x509
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.serialization import pkcs12

    cert = _x509.load_pem_x509_certificate(cert_row.pem.encode())
    key  = serialization.load_pem_private_key(cert_row.private_key_pem.encode(), password=None)

    # Bundle CA chain so Windows/macOS can validate the cert on import
    ca_key, ca_cert, _, _ = _bootstrap(db)
    cas = [ca_cert]

    # If issued by intermediate, also include intermediate cert
    if cert_row.issued_by == "intermediate":
        import os
        from config import INTERMEDIATE_CONFIG
        int_cert_path = INTERMEDIATE_CONFIG.get("cert_path", "")
        if os.path.exists(int_cert_path):
            with open(int_cert_path, "rb") as f:
                int_cert = _x509.load_pem_x509_certificate(f.read())
            cas = [int_cert, ca_cert]

    p12_bytes = pkcs12.serialize_key_and_certificates(
        name        = cert_row.common_name.encode(),
        key         = key,
        cert        = cert,
        cas         = cas,
        encryption_algorithm = serialization.BestAvailableEncryption(password.encode()),
    )

    filename = f"{cert_row.common_name.replace(' ', '_')}_{serial[:8]}.p12"
    return Response(
        content      = p12_bytes,
        media_type   = "application/x-pkcs12",
        headers      = {"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


class SendRequest(BaseModel):
    serial:  str
    email:   str
    message: str = ""


@router.post("/send")
def send_certificate(req: SendRequest, db: Session = Depends(get_db)):
    cert = db.query(Certificate).filter(Certificate.serial == req.serial).first()
    if not cert:
        raise HTTPException(404, "Certificate not found.")
    if cert.revocation is not None:
        raise HTTPException(409, "Cannot send a revoked certificate.")

    _, ca_cert, audit, _ = _bootstrap(db)
    audit.log("CERT_SENT", {
        "serial":      req.serial,
        "common_name": cert.common_name,
        "sent_to":     req.email,
        "message":     req.message,
    })

    from utils.email_sender import send_certificate_email
    email_result = send_certificate_email(
        to_email        = req.email,
        to_name         = cert.common_name,
        message         = req.message,
        pem             = cert.pem,
        private_key_pem = cert.private_key_pem,
        cert_serial     = cert.serial,
        template        = cert.template,
        not_after       = cert.not_after.isoformat() if cert.not_after else "",
    )

    return {
        "sent":            email_result["sent"],
        "email_error":     email_result.get("error"),
        "serial":          req.serial,
        "common_name":     cert.common_name,
        "sent_to":         req.email,
        "pem":             cert.pem,
        "private_key_pem": cert.private_key_pem,
    }


@router.delete("/{serial}")
def delete_certificate(serial: str, db: Session = Depends(get_db)):
    cert = db.query(Certificate).filter(Certificate.serial == serial).first()
    if not cert:
        raise HTTPException(404, "Certificate not found.")
    # Delete revocation record first (FK constraint)
    db.query(RevokedCert).filter(RevokedCert.serial == serial).delete()
    db.delete(cert)
    db.commit()
    return {"deleted": True, "serial": serial}


@router.post("/revoke")
def revoke_certificate(req: RevokeRequest, db: Session = Depends(get_db)):
    if req.reason not in REASON_MAP:
        raise HTTPException(400, f"Invalid reason. Choose from: {list(REASON_MAP)}")

    # Ensure serial belongs to a user certificate, not the CA itself
    cert_row = db.query(Certificate).filter(Certificate.serial == req.serial).first()
    if not cert_row:
        raise HTTPException(404, "Certificate not found. Only user certificates can be revoked. Use the serial number from the All Certificates tab.")

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
