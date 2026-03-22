from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os
from ca.ca_setup import CertificateAuthority
from config import CA_CONFIG

router = APIRouter()


class CAUpdateIn(BaseModel):
    common_name:   str
    org:           str
    org_unit:      str
    country:       str
    state:         str
    locality:      str
    validity_days: int = 3650


@router.post("/init")
def init_ca():
    ca = CertificateAuthority()
    _, cert = ca.initialize()
    return _serialize(cert)


@router.post("/regenerate")
def regenerate_ca(body: CAUpdateIn):
    """Delete existing CA files and generate a new CA with updated details."""
    if len(body.country) != 2:
        raise HTTPException(400, "Country must be exactly 2 letters.")

    # Delete existing CA files so initialize() generates fresh ones
    for path in [CA_CONFIG["ca_key_path"], CA_CONFIG["ca_cert_path"]]:
        if os.path.exists(path):
            os.remove(path)

    # Patch config with new values
    updated = {**CA_CONFIG,
        "common_name":    body.common_name,
        "org":            body.org,
        "org_unit":       body.org_unit,
        "country":        body.country,
        "state":          body.state,
        "locality":       body.locality,
        "validity_days":  body.validity_days,
    }
    ca = CertificateAuthority(config=updated)
    _, cert = ca.generate_root_ca()
    return _serialize(cert)


@router.get("/status")
def ca_status():
    ca = CertificateAuthority()
    _, cert = ca.initialize()
    return _serialize(cert)


def _serialize(cert):
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
