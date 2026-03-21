"""
api/routes/ocsp.py — OCSP (Online Certificate Status Protocol) Responder.

Real-world flow:
  1. Browser connects to https://example.com
  2. Server presents its certificate
  3. Browser extracts the OCSP URL from the cert's AIA extension
  4. Browser sends an OCSP Request to this endpoint
  5. This responder checks the CRL registry and returns a signed OCSP Response
  6. Browser accepts or rejects the connection based on the response

POST /ocsp   — accepts DER-encoded OCSP request, returns DER-encoded OCSP response
GET  /ocsp/status/{serial} — human-readable JSON status (non-standard, for debugging)
"""

import datetime
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response, JSONResponse

from ca.ca_setup import CertificateAuthority
from ca.crl_manager import CRLManager
from audit.audit_log import AuditLog
from config import CA_CONFIG
from logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


def _get_crl_manager() -> CRLManager:
    ca = CertificateAuthority()
    ca_key, ca_cert = ca.initialize()
    audit = AuditLog(CA_CONFIG["audit_log_path"])
    return CRLManager(ca_key, ca_cert, audit), ca_key, ca_cert


@router.post("/ocsp")
async def ocsp_responder(request: Request):
    """
    RFC 6960 OCSP Responder.
    Accepts application/ocsp-request, returns application/ocsp-response.
    """
    body = await request.body()
    if not body:
        raise HTTPException(400, "Empty OCSP request body.")

    try:
        from cryptography.x509 import ocsp
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding

        ocsp_req = ocsp.load_der_ocsp_request(body)
        serial   = ocsp_req.serial_number

        crl_mgr, ca_key, ca_cert = _get_crl_manager()

        now = datetime.datetime.now(datetime.timezone.utc)

        builder = ocsp.OCSPResponseBuilder()

        if crl_mgr.is_revoked(serial):
            info       = crl_mgr.get_revocation_info(serial)
            revoked_at = datetime.datetime.fromisoformat(info["revoked_at"])
            builder    = builder.add_response(
                cert=None,
                issuer=ca_cert,
                algorithm=hashes.SHA1(),
                cert_status=ocsp.OCSPCertStatus.REVOKED,
                this_update=now,
                next_update=now + datetime.timedelta(hours=1),
                revocation_time=revoked_at,
                revocation_reason=None,
            ).responder_id(ocsp.OCSPResponderEncoding.HASH, ca_cert)
        else:
            builder = builder.add_response(
                cert=None,
                issuer=ca_cert,
                algorithm=hashes.SHA1(),
                cert_status=ocsp.OCSPCertStatus.GOOD,
                this_update=now,
                next_update=now + datetime.timedelta(hours=1),
                revocation_time=None,
                revocation_reason=None,
            ).responder_id(ocsp.OCSPResponderEncoding.HASH, ca_cert)

        ocsp_response = builder.sign(ca_key, hashes.SHA256())
        der_response  = ocsp_response.public_bytes(serialization.Encoding.DER)

        logger.info("OCSP query — serial %s → %s",
                    serial, "REVOKED" if crl_mgr.is_revoked(serial) else "GOOD")

        return Response(content=der_response, media_type="application/ocsp-response")

    except Exception as e:
        logger.error("OCSP error: %s", e)
        # Return a signed "internalError" OCSP response
        from cryptography.x509 import ocsp
        from cryptography.hazmat.primitives import serialization
        error_resp = ocsp.OCSPResponseBuilder.build_unsuccessful(
            ocsp.OCSPResponseStatus.INTERNAL_ERROR
        )
        return Response(
            content=error_resp.public_bytes(serialization.Encoding.DER),
            media_type="application/ocsp-response",
            status_code=200,
        )


@router.get("/ocsp/status/{serial}")
def ocsp_status_json(serial: str):
    """Non-standard JSON endpoint for debugging certificate status."""
    crl_mgr, _, _ = _get_crl_manager()
    serial_int     = int(serial)
    revoked        = crl_mgr.is_revoked(serial_int)
    info           = crl_mgr.get_revocation_info(serial_int) if revoked else None
    return {
        "serial":  serial,
        "status":  "REVOKED" if revoked else "GOOD",
        "revocation": info,
    }
