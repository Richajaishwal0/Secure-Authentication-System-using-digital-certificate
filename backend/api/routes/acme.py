"""
api/routes/acme.py — Simplified ACME (RFC 8555) protocol implementation.

ACME is the protocol Let's Encrypt uses to automate certificate issuance
and renewal without human intervention.

Simplified flow implemented here:
  1. POST /acme/order          — client requests a cert for a domain
  2. GET  /acme/challenge/{token} — CA serves the http-01 challenge token
  3. POST /acme/challenge/{token}/validate — client signals it's ready
  4. POST /acme/finalize/{order_id} — client submits CSR, gets cert back

Real ACME (RFC 8555) also requires:
  - JWS-signed requests with account keys
  - nonce management
  - directory endpoint
  These are simplified here for clarity.
"""

import datetime
import secrets
import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import AcmeChallenge
from ca.ca_setup import CertificateAuthority
from ca.csr_generator import CSRGenerator
from ca.cert_issuer import CertificateIssuer
from audit.audit_log import AuditLog
from config import CA_CONFIG
from logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class OrderRequest(BaseModel):
    domain:      str
    email:       str
    account_key: str = ""   # JWK JSON of account public key (simplified: any string)


class FinalizeRequest(BaseModel):
    order_id: str
    csr_pem:  str           # PEM-encoded CSR from the client


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/order")
def create_order(req: OrderRequest, db: Session = Depends(get_db)):
    """
    Step 1: Client requests a certificate for a domain.
    Returns a challenge token the client must serve at:
        http://<domain>/.well-known/acme-challenge/<token>
    """
    token    = secrets.token_urlsafe(32)
    key_auth = f"{token}.{_thumbprint(req.account_key)}"
    expires  = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=10)

    challenge = AcmeChallenge(
        token       = token,
        account_key = req.account_key,
        domain      = req.domain,
        key_auth    = key_auth,
        status      = "pending",
        expires_at  = expires,
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    logger.info("ACME order created for domain '%s' — token %s", req.domain, token[:8] + "...")

    return {
        "order_id":   str(challenge.id),
        "domain":     req.domain,
        "status":     "pending",
        "token":      token,
        "key_auth":   key_auth,
        "challenge_url": f"http://{req.domain}/.well-known/acme-challenge/{token}",
        "validate_url":  f"/acme/challenge/{token}/validate",
        "finalize_url":  f"/acme/finalize/{challenge.id}",
        "expires_at": expires.isoformat(),
    }


@router.get("/challenge/{token}")
def serve_challenge(token: str, db: Session = Depends(get_db)):
    """
    Step 2: The ACME client serves this at /.well-known/acme-challenge/<token>.
    This endpoint simulates what the client would serve.
    """
    challenge = db.query(AcmeChallenge).filter(AcmeChallenge.token == token).first()
    if not challenge:
        raise HTTPException(404, "Challenge not found.")
    if challenge.status == "invalid":
        raise HTTPException(410, "Challenge has expired or failed.")
    return challenge.key_auth   # plain text response (RFC 8555 §8.3)


@router.post("/challenge/{token}/validate")
def validate_challenge(token: str, db: Session = Depends(get_db)):
    """
    Step 3: Client signals it has placed the key_auth at the challenge URL.
    In production, the CA would fetch http://<domain>/.well-known/acme-challenge/<token>
    and verify the response matches key_auth. Here we auto-validate for the prototype.
    """
    challenge = db.query(AcmeChallenge).filter(AcmeChallenge.token == token).first()
    if not challenge:
        raise HTTPException(404, "Challenge not found.")

    now = datetime.datetime.now(datetime.timezone.utc)
    if challenge.expires_at.replace(tzinfo=datetime.timezone.utc) < now:
        challenge.status = "invalid"
        db.commit()
        raise HTTPException(400, "Challenge has expired.")

    # In production: fetch http://<domain>/.well-known/acme-challenge/<token>
    # and assert response == challenge.key_auth
    # Here: auto-approve (prototype)
    challenge.status = "valid"
    db.commit()

    logger.info("ACME challenge validated for domain '%s'", challenge.domain)
    return {"status": "valid", "domain": challenge.domain, "order_id": str(challenge.id)}


@router.post("/finalize/{order_id}")
def finalize_order(order_id: str, req: FinalizeRequest, db: Session = Depends(get_db)):
    """
    Step 4: Client submits a CSR. CA issues the certificate and returns PEM.
    This is the auto-renewal step — no human interaction needed.
    """
    challenge = db.query(AcmeChallenge).filter(AcmeChallenge.id == int(order_id)).first()
    if not challenge:
        raise HTTPException(404, "Order not found.")
    if challenge.status != "valid":
        raise HTTPException(403, f"Challenge not validated. Status: {challenge.status}")

    try:
        from cryptography import x509 as _x509
        csr = _x509.load_pem_x509_csr(req.csr_pem.encode())
    except Exception:
        raise HTTPException(400, "Invalid CSR PEM.")

    ca = CertificateAuthority()
    ca_key, ca_cert = ca.initialize()
    audit  = AuditLog(CA_CONFIG["audit_log_path"])
    issuer = CertificateIssuer(ca_key, ca_cert, audit, db=db)

    cert = issuer.issue(
        csr,
        validity_days=90,           # ACME certs are typically 90 days (like Let's Encrypt)
        name=challenge.domain.replace(".", "_"),
        template_name="tls_server",
        san_names=[challenge.domain],
    )

    challenge.status = "completed"
    db.commit()

    from cryptography.hazmat.primitives import serialization
    pem = cert.public_bytes(serialization.Encoding.PEM).decode()

    logger.info("ACME finalized — cert issued for '%s' serial %s", challenge.domain, cert.serial_number)

    return {
        "status":     "valid",
        "domain":     challenge.domain,
        "serial":     str(cert.serial_number),
        "not_before": cert.not_valid_before_utc.isoformat(),
        "not_after":  cert.not_valid_after_utc.isoformat(),
        "pem":        pem,
    }


@router.get("/renewals/due")
def list_renewals_due(days_ahead: int = 30, db: Session = Depends(get_db)):
    """
    List certificates expiring within `days_ahead` days.
    Clients can poll this to trigger auto-renewal.
    """
    from db.models import Certificate
    from datetime import timezone
    threshold = datetime.datetime.now(timezone.utc) + datetime.timedelta(days=days_ahead)
    expiring  = db.query(Certificate).filter(Certificate.not_after <= threshold).all()
    return [
        {
            "serial":      c.serial,
            "common_name": c.common_name,
            "email":       c.email,
            "not_after":   c.not_after.isoformat(),
            "days_left":   (c.not_after.replace(tzinfo=timezone.utc) -
                            datetime.datetime.now(timezone.utc)).days,
        }
        for c in expiring
        if c.revocation is None
    ]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _thumbprint(account_key: str) -> str:
    """
    Compute a simplified JWK thumbprint (RFC 7638).
    In production this would be SHA-256 of the canonical JWK JSON.
    """
    import hashlib
    return hashlib.sha256(account_key.encode()).hexdigest()[:16]
