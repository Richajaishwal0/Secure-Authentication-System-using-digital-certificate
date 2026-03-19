from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa

from utils.crypto_utils import (
    generate_rsa_key,
    serialize_private_key,
    serialize_csr,
    save_file,
)
from config import CA_CONFIG
from logger import get_logger

logger = get_logger(__name__)


class CSRGenerator:
    """
    Generates an RSA key pair and a PKCS#10 Certificate Signing Request (CSR)
    for a given subject identity.

    Usage:
        gen = CSRGenerator(subject={...})
        private_key = gen.generate_key_pair()
        csr         = gen.build_csr(private_key)
        gen.save(private_key, csr, name="client1")
    """

    def __init__(self, subject: dict, config: dict = None):
        """
        Args:
            subject: dict with keys — common_name, country, state, locality,
                     org, org_unit, email
            config:  optional override of CA_CONFIG
        """
        self._validate_subject(subject)
        self.subject = subject
        self.config = config or CA_CONFIG

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate_key_pair(self) -> rsa.RSAPrivateKey:
        """Generate a fresh RSA private key for the certificate requester."""
        key = generate_rsa_key(self.config["key_size"])
        logger.info("Generated %d-bit RSA key for '%s'",
                    key.key_size, self.subject["common_name"])
        return key

    def build_csr(self, private_key: rsa.RSAPrivateKey) -> x509.CertificateSigningRequest:
        """
        Build and sign a PKCS#10 CSR using the requester's private key.
        The CSR carries the subject identity and public key.
        """
        csr = (
            x509.CertificateSigningRequestBuilder()
            .subject_name(self._build_subject())
            .add_extension(
                x509.BasicConstraints(ca=False, path_length=None),
                critical=True,
            )
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=True,    # non-repudiation
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
                    x509.oid.ExtendedKeyUsageOID.CLIENT_AUTH,
                    x509.oid.ExtendedKeyUsageOID.EMAIL_PROTECTION,
                ]),
                critical=False,
            )
            .sign(private_key, hashes.SHA256())
        )
        logger.info("CSR built for subject: %s", self.subject["common_name"])
        return csr

    def save(
        self,
        private_key: rsa.RSAPrivateKey,
        csr: x509.CertificateSigningRequest,
        name: str,
    ) -> tuple[str, str]:
        """
        Persist the requester's private key (encrypted) and CSR to disk.
        Returns (key_path, csr_path).
        """
        key_path = f"{self.config['csr_dir']}\\{name}_private_key.pem"
        csr_path = f"{self.config['csr_dir']}\\{name}_csr.pem"

        save_file(
            key_path,
            serialize_private_key(private_key, self.config["key_password"]),
            mode=0o600,
        )
        save_file(csr_path, serialize_csr(csr), mode=0o644)

        logger.info("Saved key  → %s", key_path)
        logger.info("Saved CSR  → %s", csr_path)
        return key_path, csr_path

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_subject(self) -> x509.Name:
        s = self.subject
        return x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME,             s["country"]),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME,   s["state"]),
            x509.NameAttribute(NameOID.LOCALITY_NAME,            s["locality"]),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME,        s["org"]),
            x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, s["org_unit"]),
            x509.NameAttribute(NameOID.COMMON_NAME,              s["common_name"]),
            x509.NameAttribute(NameOID.EMAIL_ADDRESS,            s["email"]),
        ])

    @staticmethod
    def _validate_subject(subject: dict) -> None:
        required = {"common_name", "country", "state", "locality", "org", "org_unit", "email"}
        missing = required - subject.keys()
        if missing:
            raise ValueError(f"Missing subject fields: {missing}")
