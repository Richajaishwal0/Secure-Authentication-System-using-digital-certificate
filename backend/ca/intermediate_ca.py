"""
ca/intermediate_ca.py — Intermediate Certificate Authority.

Real PKI hierarchy:
    Root CA (offline, self-signed)
        └── Intermediate CA (signed by Root, online)
                └── End-entity certificates (signed by Intermediate)

The root CA private key stays offline. Only the intermediate CA key
is used day-to-day to issue certificates. If the intermediate is
compromised, the root can revoke it and issue a new one without
replacing the root trust anchor.
"""

import datetime
import os

from cryptography import x509
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
from cryptography.hazmat.primitives import hashes

from utils.crypto_utils import (
    generate_rsa_key, serialize_private_key, serialize_cert,
    load_private_key, load_certificate, save_file,
)
from ca.cert_templates import get_template, apply_template, CertTemplate
from audit.audit_log import AuditLog
from config import CA_CONFIG, INTERMEDIATE_CONFIG, OCSP_URL, CRL_URL
from logger import get_logger

logger = get_logger(__name__)


class IntermediateCA:
    """
    Manages the Intermediate CA lifecycle:
      - Generate its own RSA key pair
      - Build a CSR and have the Root CA sign it (path_length=0)
      - Issue end-entity certificates using the intermediate key
    """

    def __init__(self, root_key, root_cert, audit: AuditLog, config: dict = None, db=None):
        self.root_key   = root_key
        self.root_cert  = root_cert
        self.audit      = audit
        self.config     = config or INTERMEDIATE_CONFIG
        self.db         = db
        self.int_key    = None
        self.int_cert   = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def initialize(self):
        """Load existing intermediate CA or generate a new one signed by root."""
        if self._exists():
            logger.info("Existing Intermediate CA found — loading from disk.")
            return self._load()
        logger.info("No Intermediate CA found — generating new one.")
        return self._generate()

    def issue(
        self,
        csr: x509.CertificateSigningRequest,
        validity_days: int = 365,
        name: str = "certificate",
        template_name: str = "client_auth",
        san_names: list[str] | None = None,
        private_key=None,
    ) -> x509.Certificate:
        """
        Issue an end-entity certificate signed by the Intermediate CA.
        Supports all certificate templates and Subject Alternative Names.
        """
        if not csr.is_signature_valid:
            raise ValueError("CSR signature invalid — request rejected.")

        template = get_template(template_name)
        cert = self._build_cert(csr, validity_days, template, san_names)
        path = self._save(cert, name)

        if self.db is not None:
            self._save_to_db(cert, template_name, private_key=private_key)

        self.audit.log("CERT_ISSUED", {
            "subject":    cert.subject.rfc4514_string(),
            "serial":     cert.serial_number,
            "template":   template_name,
            "issued_by":  "intermediate",
            "valid_from": cert.not_valid_before_utc.isoformat(),
            "valid_until":cert.not_valid_after_utc.isoformat(),
            "saved_to":   path,
        })
        logger.info("Intermediate CA issued cert — serial %s → %s", cert.serial_number, path)
        return cert

    # ------------------------------------------------------------------
    # Certificate construction
    # ------------------------------------------------------------------

    def _generate(self):
        self.int_key  = generate_rsa_key(self.config["key_size"])
        self.int_cert = self._build_intermediate_cert(self.int_key)
        self._persist()
        self.audit.log("INTERMEDIATE_CA_INITIALIZED", {
            "subject": self.int_cert.subject.rfc4514_string(),
            "serial":  self.int_cert.serial_number,
        })
        logger.info("Intermediate CA generated. Serial: %s", self.int_cert.serial_number)
        return self.int_key, self.int_cert

    def _build_intermediate_cert(self, key):
        subject = self._build_subject()
        now     = datetime.datetime.now(datetime.timezone.utc)

        return (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(self.root_cert.subject)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(now + datetime.timedelta(days=self.config["validity_days"]))
            .add_extension(
                x509.BasicConstraints(ca=True, path_length=0),  # can sign end-entity only
                critical=True,
            )
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True, content_commitment=False,
                    key_encipherment=False, data_encipherment=False,
                    key_agreement=False, key_cert_sign=True, crl_sign=True,
                    encipher_only=False, decipher_only=False,
                ),
                critical=True,
            )
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(key.public_key()),
                critical=False,
            )
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(self.root_key.public_key()),
                critical=False,
            )
            .sign(self.root_key, hashes.SHA256())   # signed by ROOT
        )

    def _build_cert(
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
            .issuer_name(self.int_cert.subject)
            .public_key(csr.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(now + datetime.timedelta(days=validity_days))
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(csr.public_key()),
                critical=False,
            )
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(self.int_key.public_key()),
                critical=False,
            )
        )
        builder = apply_template(builder, template, san_names, ocsp_url=OCSP_URL, crl_url=CRL_URL)
        return builder.sign(self.int_key, hashes.SHA256())

    def _build_subject(self) -> x509.Name:
        cfg = self.config
        return x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME,             cfg["country"]),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME,   cfg["state"]),
            x509.NameAttribute(NameOID.LOCALITY_NAME,            cfg["locality"]),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME,        cfg["org"]),
            x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, cfg["org_unit"]),
            x509.NameAttribute(NameOID.COMMON_NAME,              cfg["common_name"]),
            x509.NameAttribute(NameOID.EMAIL_ADDRESS,            cfg["email"]),
        ])

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _save(self, cert: x509.Certificate, name: str) -> str:
        """Save issued end-entity certificate to the certs directory."""
        path = os.path.join(CA_CONFIG["certs_dir"], f"{name}_{cert.serial_number}.pem")
        save_file(path, serialize_cert(cert), mode=0o644)
        return path

    def _save_to_db(self, cert: x509.Certificate, template_name: str, private_key=None) -> None:
        from db.models import Certificate
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.serialization import Encoding

        def _attr(name_obj, oid):
            try:
                return name_obj.get_attributes_for_oid(oid)[0].value
            except IndexError:
                return ""

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
            issued_by       = "intermediate",
            not_before      = cert.not_valid_before_utc.replace(tzinfo=None),
            not_after       = cert.not_valid_after_utc.replace(tzinfo=None),
            pem             = cert.public_bytes(Encoding.PEM).decode(),
            private_key_pem = key_pem,
        )
        self.db.add(row)
        self.db.commit()

    def _persist(self):
        save_file(self.config["key_path"],  serialize_private_key(self.int_key, self.config["key_password"]), mode=0o600)
        save_file(self.config["cert_path"], serialize_cert(self.int_cert), mode=0o644)

    def _load(self):
        self.int_key  = load_private_key(self.config["key_path"], self.config["key_password"])
        self.int_cert = load_certificate(self.config["cert_path"])
        logger.info("Intermediate CA loaded. Subject: %s", self.int_cert.subject.rfc4514_string())
        return self.int_key, self.int_cert

    def _exists(self) -> bool:
        return os.path.exists(self.config["key_path"]) and os.path.exists(self.config["cert_path"])
