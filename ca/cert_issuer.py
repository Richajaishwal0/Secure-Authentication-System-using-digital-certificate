import datetime

from cryptography import x509
from cryptography.x509.oid import ExtendedKeyUsageOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa

from audit.audit_log import AuditLog
from utils.crypto_utils import serialize_cert, save_file
from config import CA_CONFIG
from logger import get_logger

logger = get_logger(__name__)


class CertificateIssuer:
    """
    Signs a PKCS#10 CSR using the CA's private key and produces
    a fully-formed X.509 v3 end-entity certificate.

    Usage:
        issuer = CertificateIssuer(ca_key, ca_cert, audit_log)
        cert   = issuer.issue(csr, validity_days=365, name="client1")
    """

    def __init__(
        self,
        ca_key:  rsa.RSAPrivateKey,
        ca_cert: x509.Certificate,
        audit_log: AuditLog,
        config: dict = None,
    ):
        self.ca_key   = ca_key
        self.ca_cert  = ca_cert
        self.audit    = audit_log
        self.config   = config or CA_CONFIG

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def issue(
        self,
        csr: x509.CertificateSigningRequest,
        validity_days: int = 365,
        name: str = "certificate",
    ) -> x509.Certificate:
        """
        Validate the CSR signature, build and sign the certificate,
        persist it, and write an audit entry.

        Args:
            csr:           Parsed PKCS#10 CSR object
            validity_days: How long the issued cert is valid
            name:          Filename stem used when saving to disk

        Returns:
            Signed x509.Certificate
        """
        self._verify_csr_signature(csr)

        cert = self._build_certificate(csr, validity_days)
        cert_path = self._save(cert, name)

        self.audit.log("CERT_ISSUED", {
            "subject":      cert.subject.rfc4514_string(),
            "serial":       cert.serial_number,
            "valid_from":   cert.not_valid_before_utc.isoformat(),
            "valid_until":  cert.not_valid_after_utc.isoformat(),
            "saved_to":     cert_path,
        })

        logger.info("Certificate issued — serial %s → %s", cert.serial_number, cert_path)
        return cert

    # ------------------------------------------------------------------
    # Certificate construction
    # ------------------------------------------------------------------

    def _build_certificate(
        self,
        csr: x509.CertificateSigningRequest,
        validity_days: int,
    ) -> x509.Certificate:
        now      = datetime.datetime.now(datetime.timezone.utc)
        validity = datetime.timedelta(days=validity_days)

        cert = (
            x509.CertificateBuilder()
            .subject_name(csr.subject)
            .issuer_name(self.ca_cert.subject)
            .public_key(csr.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(now + validity)
            # --- X.509 v3 extensions ---
            .add_extension(
                x509.BasicConstraints(ca=False, path_length=None),
                critical=True,
            )
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=True,
                    key_encipherment=True,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=False,
                    crl_sign=False,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
            .add_extension(
                x509.ExtendedKeyUsage([
                    ExtendedKeyUsageOID.CLIENT_AUTH,
                    ExtendedKeyUsageOID.EMAIL_PROTECTION,
                ]),
                critical=False,
            )
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(csr.public_key()),
                critical=False,
            )
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(
                    self.ca_key.public_key()
                ),
                critical=False,
            )
            .sign(self.ca_key, hashes.SHA256())
        )
        return cert

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _verify_csr_signature(self, csr: x509.CertificateSigningRequest) -> None:
        """Reject CSRs whose self-signature doesn't verify — prevents tampering."""
        if not csr.is_signature_valid:
            raise ValueError("CSR signature is invalid — request rejected.")
        logger.info("CSR signature verified for: %s", csr.subject.rfc4514_string())

    def _save(self, cert: x509.Certificate, name: str) -> str:
        path = f"{self.config['certs_dir']}\\{name}_{cert.serial_number}.pem"
        save_file(path, serialize_cert(cert), mode=0o644)
        return path
