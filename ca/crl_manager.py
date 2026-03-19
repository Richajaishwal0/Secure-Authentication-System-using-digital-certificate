import datetime
import json
import os

from cryptography import x509
from cryptography.x509 import ReasonFlags
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from audit.audit_log import AuditLog
from utils.crypto_utils import save_file
from config import CA_CONFIG
from logger import get_logger

logger = get_logger(__name__)

# Valid revocation reason strings → x509.ReasonFlags
REASON_MAP: dict[str, ReasonFlags] = {
    "unspecified":            ReasonFlags.unspecified,
    "key_compromise":         ReasonFlags.key_compromise,
    "ca_compromise":          ReasonFlags.ca_compromise,
    "affiliation_changed":    ReasonFlags.affiliation_changed,
    "superseded":             ReasonFlags.superseded,
    "cessation_of_operation": ReasonFlags.cessation_of_operation,
    "privilege_withdrawn":    ReasonFlags.privilege_withdrawn,
}


class CRLManager:
    """
    Manages certificate revocation:
      - Tracks revoked serials + reasons in a JSON registry
      - Builds and signs an X.509 CRL using the CA key
      - Provides fast is_revoked() lookup without parsing the CRL

    Usage:
        crl_mgr = CRLManager(ca_key, ca_cert, audit)
        crl_mgr.revoke(serial, reason="key_compromise")
        crl_mgr.is_revoked(serial)   # → True
        crl_mgr.build_and_save_crl()
    """

    def __init__(
        self,
        ca_key:   rsa.RSAPrivateKey,
        ca_cert:  x509.Certificate,
        audit:    AuditLog,
        config:   dict = None,
    ):
        self.ca_key  = ca_key
        self.ca_cert = ca_cert
        self.audit   = audit
        self.config  = config or CA_CONFIG

        self._registry_path = os.path.join(self.config["crl_dir"], "revoked_registry.json")
        self._crl_path       = os.path.join(self.config["crl_dir"], "ca.crl.pem")
        self._revoked: dict[str, dict] = self._load_registry()   # serial_str → {reason, revoked_at}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def revoke(self, serial: int, reason: str = "unspecified") -> None:
        """
        Mark a certificate serial as revoked, persist the registry,
        rebuild the signed CRL, and write an audit entry.
        """
        if reason not in REASON_MAP:
            raise ValueError(f"Invalid reason '{reason}'. Choose from: {list(REASON_MAP)}")

        serial_str = str(serial)
        if serial_str in self._revoked:
            logger.warning("Serial %s already revoked.", serial_str)
            return

        revoked_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self._revoked[serial_str] = {"reason": reason, "revoked_at": revoked_at}
        self._save_registry()
        self.build_and_save_crl()

        self.audit.log("CERT_REVOKED", {
            "serial":     serial,
            "reason":     reason,
            "revoked_at": revoked_at,
        })
        logger.info("Revoked serial %s — reason: %s", serial_str, reason)

    def is_revoked(self, serial: int) -> bool:
        """Fast O(1) revocation check against the in-memory registry."""
        return str(serial) in self._revoked

    def get_revocation_info(self, serial: int) -> dict | None:
        """Return revocation metadata for a serial, or None if not revoked."""
        return self._revoked.get(str(serial))

    def build_and_save_crl(self) -> x509.CertificateRevocationList:
        """Build a signed X.509 CRL from the current revoked set and save to disk."""
        crl = self._build_crl()
        crl_pem = crl.public_bytes(serialization.Encoding.PEM)
        save_file(self._crl_path, crl_pem, mode=0o644)
        logger.info("CRL saved → %s  (%d revoked)", self._crl_path, len(self._revoked))
        return crl

    # ------------------------------------------------------------------
    # CRL construction
    # ------------------------------------------------------------------

    def _build_crl(self) -> x509.CertificateRevocationList:
        now      = datetime.datetime.now(datetime.timezone.utc)
        next_upd = now + datetime.timedelta(days=7)   # CRL valid for 7 days

        builder = (
            x509.CertificateRevocationListBuilder()
            .issuer_name(self.ca_cert.subject)
            .last_update(now)
            .next_update(next_upd)
            .add_extension(
                x509.AuthorityKeyIdentifier.from_issuer_public_key(
                    self.ca_key.public_key()
                ),
                critical=False,
            )
            .add_extension(
                x509.CRLNumber(self._crl_number()),
                critical=False,
            )
        )

        for serial_str, meta in self._revoked.items():
            revoked_at = datetime.datetime.fromisoformat(meta["revoked_at"])
            reason_flag = REASON_MAP.get(meta["reason"], ReasonFlags.unspecified)
            revoked_cert = (
                x509.RevokedCertificateBuilder()
                .serial_number(int(serial_str))
                .revocation_date(revoked_at)
                .add_extension(
                    x509.CRLReason(reason_flag),
                    critical=False,
                )
                .build()
            )
            builder = builder.add_revoked_certificate(revoked_cert)

        return builder.sign(self.ca_key, hashes.SHA256())

    # ------------------------------------------------------------------
    # Registry persistence
    # ------------------------------------------------------------------

    def _save_registry(self) -> None:
        os.makedirs(os.path.dirname(self._registry_path), exist_ok=True)
        with open(self._registry_path, "w") as f:
            json.dump(self._revoked, f, indent=2)

    def _load_registry(self) -> dict:
        if os.path.exists(self._registry_path):
            with open(self._registry_path, "r") as f:
                return json.load(f)
        return {}

    def _crl_number(self) -> int:
        """CRL number = count of revoked entries (monotonically increases)."""
        return len(self._revoked)
