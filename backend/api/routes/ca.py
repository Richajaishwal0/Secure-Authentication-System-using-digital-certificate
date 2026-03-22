"""
api/routes/ca.py — Root CA initialisation endpoint.

POST /api/ca/init   — initialise (or load) the Root CA
GET  /api/ca/status — return CA certificate details
"""

from fastapi import APIRouter
from ca.ca_setup import CertificateAuthority

router = APIRouter()


@router.post("/init")
def init_ca():
    ca = CertificateAuthority()
    _, cert = ca.initialize()
    return {
        "status":     "ready",
        "subject":    cert.subject.rfc4514_string(),
        "issuer":     cert.issuer.rfc4514_string(),
        "serial":     str(cert.serial_number),
        "not_before": cert.not_valid_before_utc.isoformat(),
        "not_after":  cert.not_valid_after_utc.isoformat(),
        "key_size":   2048,
        "algorithm":  "SHA-256 with RSA",
    }


@router.get("/status")
def ca_status():
    ca = CertificateAuthority()
    _, cert = ca.initialize()
    return {
        "subject":    cert.subject.rfc4514_string(),
        "serial":     str(cert.serial_number),
        "not_before": cert.not_valid_before_utc.isoformat(),
        "not_after":  cert.not_valid_after_utc.isoformat(),
    }
