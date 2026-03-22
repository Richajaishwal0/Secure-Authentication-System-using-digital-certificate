"""
ca/cert_issuer.py — Signs CSRs and issues X.509 v3 end-entity certificates.

Supports:
  - Certificate templates (client_auth, tls_server, email_signing, code_signing)
  - Subject Alternative Names (for TLS server certs)
  - OCSP AIA + CRL Distribution Point extensions embedded in every cert
  - Optional DB persistence alongside PEM file storage
"""

import datetime

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from audit.audit_log import AuditLog
from ca.cert_templates import get_template, apply_template, CertTemplate
from utils.crypto_utils import serialize_cert, save_file
from config import CA_CONFIG, OCSP_URL, CRL_URL
from logger import get_logger

logger = get_logger(__name__)


class CertificateIssuer:
    """
    Signs a PKCS#10 CSR using the CA's private key and produces
    a fully-formed X.509 v3 end-entity certificate.

    Usage:
        issuer = CertificateIssuer(ca_key, ca_cert, audit_log)
        cert   = issuer.issue(csr, validity_days=365, name="client1",
                              template_name="tls_server",
                              san_names=["example.com", "www.example.com"])
    """

    def __init__(self, ca_key, ca_cert, audit_log: AuditLog, config: dict = None, db=None):
        self.ca_key  = ca_key
        self.ca_cert = ca_cert
        self.audit   = audit_log
        self.config  = config or CA_CONFIG
        self.db      = db       # optional SQLAlchemy session

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def issue(
        self,
        csr: x509.CertificateSigningRequest,
        validity_days: int = 365,
        name: str = "certificate",
        template_name: str = "client_auth",
        san_names: list[str] | None = None,
        private_key: rsa.RSAPrivateKey | None = None,
    ) -> x509.Certificate:
        """
        Validate CSR, build and sign the certificate, persist it,
        optionally store in DB, and write an audit entry.
        Returns the certificate. private_key is stored in DB if provided.
        """
        self._verify_csr_signature(csr)

        template = get_template(template_name)
        if validity_days == 365 and template.default_days != 365:
            validity_days = template.default_days

        cert      = self._build_certificate(csr, validity_days, template, san_names)
        cert_path = self._save(cert, name)

        if self.db is not None:
            self._save_to_db(cert, template_name, issued_by="root", private_key=private_key)

        self.audit.log("CERT_ISSUED", {
            "subject":    cert.subject.rfc4514_string(),
            "serial":     cert.serial_number,
            "template":   template_name,
            "valid_from": cert.not_valid_before_utc.isoformat(),
            "valid_until":cert.not_valid_after_utc.isoformat(),
            "saved_to":   cert_path,
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
        template: CertTemplate,
        san_names: list[str] | None,
    ) -> x509.Certificate:
        now = datetime.datetime.now(datetime.timezone.utc)

        builder = (
            x509.CertificateBuilder()
            .subject_name(csr.subject)
            .issuer_name(self.ca_cert.subject)
            .public_key(csr.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(now + datetime.timedelta(days=validity_days))
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(csr.public_key()),
                critical=False,
            )
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(self.ca_key.public_key()),
                critical=False,
            )
        )
        builder = apply_template(builder, template, san_names, ocsp_url=OCSP_URL, crl_url=CRL_URL)
        return builder.sign(self.ca_key, hashes.SHA256())

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _verify_csr_signature(self, csr: x509.CertificateSigningRequest) -> None:
        if not csr.is_signature_valid:
            raise ValueError("CSR signature is invalid — request rejected.")
        logger.info("CSR signature verified for: %s", csr.subject.rfc4514_string())

    def _save(self, cert: x509.Certificate, name: str) -> str:
        path = f"{self.config['certs_dir']}\\{name}_{cert.serial_number}.pem"
        save_file(path, serialize_cert(cert), mode=0o644)
        return path

    def _save_to_db(self, cert: x509.Certificate, template_name: str, issued_by: str, private_key=None) -> None:
        from db.models import Certificate
        from cryptography.x509.oid import NameOID

        def _attr(name_obj, oid):
            try:
                return name_obj.get_attributes_for_oid(oid)[0].value
            except IndexError:
                return ""

        # Serialize private key as unencrypted PEM so employee can use it directly
        key_pem = None
        if private_key is not None:
            key_pem = private_key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.TraditionalOpenSSL,
                serialization.NoEncryption(),
            ).decode()

        subj = cert.subject
        row  = Certificate(
            serial          = str(cert.serial_number),
            common_name     = _attr(subj, NameOID.COMMON_NAME),
            email           = _attr(subj, NameOID.EMAIL_ADDRESS),
            org             = _attr(subj, NameOID.ORGANIZATION_NAME),
            org_unit        = _attr(subj, NameOID.ORGANIZATIONAL_UNIT_NAME),
            country         = _attr(subj, NameOID.COUNTRY_NAME),
            state           = _attr(subj, NameOID.STATE_OR_PROVINCE_NAME),
            locality        = _attr(subj, NameOID.LOCALITY_NAME),
            template        = template_name,
            issued_by       = issued_by,
            not_before      = cert.not_valid_before_utc,
            not_after       = cert.not_valid_after_utc,
            pem             = cert.public_bytes(__import__("cryptography.hazmat.primitives.serialization",
                              fromlist=["Encoding"]).Encoding.PEM).decode(),
            private_key_pem = key_pem,
        )
        self.db.add(row)
        self.db.commit()
