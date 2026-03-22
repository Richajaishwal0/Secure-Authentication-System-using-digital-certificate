import os
import datetime

from cryptography import x509
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa

from utils.crypto_utils import (
    generate_rsa_key,
    serialize_private_key,
    serialize_cert,
    load_private_key,
    load_certificate,
    save_file,
)
from config import CA_CONFIG
from logger import get_logger

logger = get_logger(__name__)


class CertificateAuthority:
    """
    Manages the Root CA lifecycle:
      - Generate RSA private key
      - Build and sign a self-signed X.509 v3 root certificate
      - Persist key (encrypted) and certificate to disk
      - Reload an existing CA from disk
    """

    def __init__(self, config: dict = None):
        self.config = config or CA_CONFIG
        self.ca_key: rsa.RSAPrivateKey | None = None
        self.ca_cert: x509.Certificate | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def initialize(self) -> tuple[rsa.RSAPrivateKey, x509.Certificate]:
        """
        Entry point: load existing CA if present, otherwise generate a new one.
        Returns (private_key, certificate).
        """
        if self._ca_exists():
            logger.info("Existing CA found — loading from disk.")
            return self.load_ca()

        logger.info("No existing CA found — generating new Root CA.")
        return self.generate_root_ca()

    def generate_root_ca(self) -> tuple[rsa.RSAPrivateKey, x509.Certificate]:
        """Generate RSA key pair and self-signed root certificate, then persist both."""
        self.ca_key = generate_rsa_key(self.config["key_size"])
        self.ca_cert = self._build_root_cert(self.ca_key)
        self._persist()
        logger.info("Root CA generated. Serial: %s", self.ca_cert.serial_number)
        return self.ca_key, self.ca_cert

    def load_ca(self) -> tuple[rsa.RSAPrivateKey, x509.Certificate]:
        """Load CA private key and certificate from disk."""
        self.ca_key = load_private_key(
            self.config["ca_key_path"],
            self.config["key_password"],
        )
        self.ca_cert = load_certificate(self.config["ca_cert_path"])
        logger.info("CA loaded. Subject: %s", self.ca_cert.subject.rfc4514_string())
        return self.ca_key, self.ca_cert

    # ------------------------------------------------------------------
    # Certificate construction
    # ------------------------------------------------------------------

    def _build_root_cert(self, key: rsa.RSAPrivateKey) -> x509.Certificate:
        subject = self._build_subject()
        now = datetime.datetime.now(datetime.timezone.utc)
        validity = datetime.timedelta(days=self.config["validity_days"])

        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(subject)                          # self-signed: issuer == subject
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now)
            .not_valid_after(now + validity)
            # --- X.509 v3 extensions ---
            .add_extension(
                x509.BasicConstraints(ca=True, path_length=None),
                critical=True,
            )
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=False,
                    key_encipherment=False,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=True,     # CA may sign certificates
                    crl_sign=True,          # CA may sign CRLs
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
            .add_extension(
                x509.SubjectKeyIdentifier.from_public_key(key.public_key()),
                critical=False,
            )
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(key.public_key()),
                critical=False,
            )
            .sign(key, hashes.SHA256())
        )
        return cert

    def _build_subject(self) -> x509.Name:
        cfg = self.config
        attrs = [
            x509.NameAttribute(NameOID.COUNTRY_NAME,             cfg["country"]),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME,   cfg["state"]),
            x509.NameAttribute(NameOID.LOCALITY_NAME,            cfg["locality"]),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME,        cfg["org"]),
            x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, cfg["org_unit"]),
            x509.NameAttribute(NameOID.COMMON_NAME,              cfg["common_name"]),
            x509.NameAttribute(NameOID.EMAIL_ADDRESS,            cfg["email"]),
        ]
        return x509.Name(attrs)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _persist(self) -> None:
        """Save encrypted private key (0o600) and certificate (0o644) to disk."""
        save_file(
            self.config["ca_key_path"],
            serialize_private_key(self.ca_key, self.config["key_password"]),
            mode=0o600,   # owner read/write only
        )
        save_file(
            self.config["ca_cert_path"],
            serialize_cert(self.ca_cert),
            mode=0o644,   # certificate is public
        )
        logger.info("CA key saved to: %s", self.config["ca_key_path"])
        logger.info("CA cert saved to: %s", self.config["ca_cert_path"])

    def _ca_exists(self) -> bool:
        return (
            os.path.exists(self.config["ca_key_path"])
            and os.path.exists(self.config["ca_cert_path"])
        )
