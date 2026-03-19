import datetime
from dataclasses import dataclass, field

from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
from cryptography.exceptions import InvalidSignature

from ca.crl_manager import CRLManager
from audit.audit_log import AuditLog
from config import CA_CONFIG
from logger import get_logger

logger = get_logger(__name__)


@dataclass
class VerificationResult:
    valid:    bool
    serial:   int
    subject:  str
    checks:   dict[str, bool] = field(default_factory=dict)   # per-check breakdown
    reason:   str = ""                                         # failure reason if any

    def __str__(self) -> str:
        status = "VALID" if self.valid else f"INVALID ({self.reason})"
        checks = ", ".join(f"{k}={'OK' if v else 'FAIL'}" for k, v in self.checks.items())
        return f"[{status}] {self.subject} | {checks}"


class CertificateVerifier:
    """
    Verifies an X.509 certificate against three criteria:
      1. Signature  — signed by the trusted CA
      2. Expiry     — within its validity window
      3. Revocation — not present in the CRL registry

    Usage:
        verifier = CertificateVerifier(ca_cert, crl_manager, audit)
        result   = verifier.verify(cert)
        print(result)
    """

    def __init__(
        self,
        ca_cert:     x509.Certificate,
        crl_manager: CRLManager,
        audit:       AuditLog,
        config:      dict = None,
    ):
        self.ca_cert     = ca_cert
        self.crl_manager = crl_manager
        self.audit       = audit
        self.config      = config or CA_CONFIG

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def verify(self, cert: x509.Certificate) -> VerificationResult:
        """
        Run all three checks and return a VerificationResult.
        Stops at first failure but records all check outcomes.
        """
        subject = cert.subject.rfc4514_string()
        serial  = cert.serial_number
        checks  = {}

        # 1. Signature
        sig_ok = self._check_signature(cert)
        checks["signature"] = sig_ok
        if not sig_ok:
            return self._result(False, serial, subject, checks, "signature verification failed")

        # 2. Expiry
        exp_ok = self._check_expiry(cert)
        checks["expiry"] = exp_ok
        if not exp_ok:
            return self._result(False, serial, subject, checks, "certificate has expired or is not yet valid")

        # 3. Revocation
        rev_ok = not self.crl_manager.is_revoked(serial)
        checks["not_revoked"] = rev_ok
        if not rev_ok:
            info   = self.crl_manager.get_revocation_info(serial)
            reason = f"revoked — {info['reason']} at {info['revoked_at']}"
            return self._result(False, serial, subject, checks, reason)

        return self._result(True, serial, subject, checks, "")

    # ------------------------------------------------------------------
    # Individual checks
    # ------------------------------------------------------------------

    def _check_signature(self, cert: x509.Certificate) -> bool:
        """Verify the cert was signed by our CA's public key."""
        try:
            self.ca_cert.public_key().verify(
                cert.signature,
                cert.tbs_certificate_bytes,
                padding.PKCS1v15(),
                cert.signature_hash_algorithm,
            )
            return True
        except InvalidSignature:
            logger.warning("Signature check FAILED for serial %s", cert.serial_number)
            return False
        except Exception as e:
            logger.error("Signature check error: %s", e)
            return False

    def _check_expiry(self, cert: x509.Certificate) -> bool:
        """Check the certificate is within its validity window."""
        now = datetime.datetime.now(datetime.timezone.utc)
        return cert.not_valid_before_utc <= now <= cert.not_valid_after_utc

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _result(
        self,
        valid:   bool,
        serial:  int,
        subject: str,
        checks:  dict,
        reason:  str,
    ) -> VerificationResult:
        result = VerificationResult(
            valid=valid, serial=serial, subject=subject, checks=checks, reason=reason
        )
        self.audit.log("CERT_VERIFIED", {
            "serial":  serial,
            "subject": subject,
            "valid":   valid,
            "checks":  checks,
            "reason":  reason,
        })
        logger.info("Verification result: %s", result)
        return result
