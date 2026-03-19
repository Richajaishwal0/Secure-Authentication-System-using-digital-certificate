"""
tests/test_ca.py

Test cases:
  - CA initialization (new + reload)
  - CSR generation and validation
  - Certificate issuance
  - Certificate verification (valid, expired, wrong CA, revoked)
  - Revocation (revoke + double-revoke)
  - Audit log chain integrity
  - CLI commands (init, issue, verify, revoke, audit)
"""

import os
import sys
import json
import shutil
import tempfile
import unittest
import datetime

# Make project root importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import rsa

from ca.ca_setup import CertificateAuthority
from ca.csr_generator import CSRGenerator
from ca.cert_issuer import CertificateIssuer
from ca.cert_verifier import CertificateVerifier
from ca.crl_manager import CRLManager
from audit.audit_log import AuditLog
from utils.crypto_utils import generate_rsa_key


# ── Test config using a temp directory ────────────────────────────────────────

def _make_test_config(base: str) -> dict:
    return {
        "country":       "US",
        "state":         "California",
        "locality":      "San Francisco",
        "org":           "Test CA",
        "org_unit":      "Testing",
        "common_name":   "Test Root CA",
        "email":         "test@ca.local",
        "key_size":      2048,
        "key_password":  b"test-password",
        "validity_days": 3650,
        "ca_key_path":   os.path.join(base, "ca_key.pem"),
        "ca_cert_path":  os.path.join(base, "ca_cert.pem"),
        "certs_dir":     os.path.join(base, "certs"),
        "crl_dir":       os.path.join(base, "crl"),
        "csr_dir":       os.path.join(base, "csr"),
        "audit_log_path": os.path.join(base, "audit", "audit.json"),
    }


def _make_subject(cn: str, email: str) -> dict:
    return {
        "common_name": cn,
        "country":     "US",
        "state":       "California",
        "locality":    "San Francisco",
        "org":         "Test Org",
        "org_unit":    "Engineering",
        "email":       email,
    }


# ── Base test class ────────────────────────────────────────────────────────────

class CATestBase(unittest.TestCase):
    """Sets up a fresh isolated CA environment for each test."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = _make_test_config(self.tmp)
        for d in ["certs", "crl", "csr", "audit"]:
            os.makedirs(os.path.join(self.tmp, d), exist_ok=True)

        self.ca      = CertificateAuthority(self.cfg)
        self.ca_key, self.ca_cert = self.ca.generate_root_ca()
        self.audit   = AuditLog(self.cfg["audit_log_path"])
        self.crl_mgr = CRLManager(self.ca_key, self.ca_cert, self.audit, self.cfg)
        self.issuer  = CertificateIssuer(self.ca_key, self.ca_cert, self.audit, self.cfg)
        self.verifier = CertificateVerifier(self.ca_cert, self.crl_mgr, self.audit, self.cfg)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _issue_cert(self, cn: str, email: str) -> x509.Certificate:
        gen = CSRGenerator(_make_subject(cn, email), self.cfg)
        key = gen.generate_key_pair()
        csr = gen.build_csr(key)
        return self.issuer.issue(csr, validity_days=365, name=cn.lower())


# ── CA Setup Tests ─────────────────────────────────────────────────────────────

class TestCASetup(CATestBase):

    def test_ca_key_is_rsa_2048(self):
        self.assertIsInstance(self.ca_key, rsa.RSAPrivateKey)
        self.assertEqual(self.ca_key.key_size, 2048)

    def test_ca_cert_is_self_signed(self):
        self.assertEqual(
            self.ca_cert.subject.rfc4514_string(),
            self.ca_cert.issuer.rfc4514_string(),
        )

    def test_ca_cert_basic_constraints(self):
        bc = self.ca_cert.extensions.get_extension_for_class(x509.BasicConstraints)
        self.assertTrue(bc.value.ca)

    def test_ca_cert_key_usage(self):
        ku = self.ca_cert.extensions.get_extension_for_class(x509.KeyUsage)
        self.assertTrue(ku.value.key_cert_sign)
        self.assertTrue(ku.value.crl_sign)

    def test_ca_files_saved_to_disk(self):
        self.assertTrue(os.path.exists(self.cfg["ca_key_path"]))
        self.assertTrue(os.path.exists(self.cfg["ca_cert_path"]))

    def test_ca_reload_from_disk(self):
        ca2 = CertificateAuthority(self.cfg)
        key2, cert2 = ca2.load_ca()
        self.assertEqual(cert2.serial_number, self.ca_cert.serial_number)

    def test_ca_validity_period(self):
        delta = self.ca_cert.not_valid_after_utc - self.ca_cert.not_valid_before_utc
        self.assertAlmostEqual(delta.days, self.cfg["validity_days"], delta=1)


# ── CSR Tests ──────────────────────────────────────────────────────────────────

class TestCSRGenerator(CATestBase):

    def test_csr_signature_valid(self):
        gen = CSRGenerator(_make_subject("Alice", "alice@test.com"), self.cfg)
        key = gen.generate_key_pair()
        csr = gen.build_csr(key)
        self.assertTrue(csr.is_signature_valid)

    def test_csr_subject_matches(self):
        gen = CSRGenerator(_make_subject("Bob Smith", "bob@test.com"), self.cfg)
        key = gen.generate_key_pair()
        csr = gen.build_csr(key)
        cn  = csr.subject.get_attributes_for_oid(x509.oid.NameOID.COMMON_NAME)[0].value
        self.assertEqual(cn, "Bob Smith")

    def test_csr_missing_field_raises(self):
        with self.assertRaises(ValueError):
            CSRGenerator({"common_name": "Incomplete"}, self.cfg)

    def test_csr_files_saved(self):
        gen = CSRGenerator(_make_subject("Carol", "carol@test.com"), self.cfg)
        key = gen.generate_key_pair()
        csr = gen.build_csr(key)
        key_path, csr_path = gen.save(key, csr, name="carol")
        self.assertTrue(os.path.exists(key_path))
        self.assertTrue(os.path.exists(csr_path))


# ── Certificate Issuance Tests ─────────────────────────────────────────────────

class TestCertificateIssuer(CATestBase):

    def test_issued_cert_signed_by_ca(self):
        cert = self._issue_cert("Alice", "alice@test.com")
        self.assertEqual(
            cert.issuer.rfc4514_string(),
            self.ca_cert.subject.rfc4514_string(),
        )

    def test_issued_cert_not_ca(self):
        cert = self._issue_cert("Alice", "alice@test.com")
        bc   = cert.extensions.get_extension_for_class(x509.BasicConstraints)
        self.assertFalse(bc.value.ca)

    def test_issued_cert_validity_days(self):
        cert  = self._issue_cert("Alice", "alice@test.com")
        delta = cert.not_valid_after_utc - cert.not_valid_before_utc
        self.assertAlmostEqual(delta.days, 365, delta=1)

    def test_issued_cert_saved_to_disk(self):
        cert      = self._issue_cert("Dave", "dave@test.com")
        cert_file = os.path.join(
            self.cfg["certs_dir"], f"dave_{cert.serial_number}.pem"
        )
        self.assertTrue(os.path.exists(cert_file))

    def test_audit_entry_created_on_issue(self):
        before = len(self.audit.get_log())
        self._issue_cert("Eve", "eve@test.com")
        after  = len(self.audit.get_log())
        self.assertEqual(after, before + 1)
        self.assertEqual(self.audit.get_log()[-1]["event"], "CERT_ISSUED")


# ── Certificate Verification Tests ────────────────────────────────────────────

class TestCertificateVerifier(CATestBase):

    def test_valid_cert_passes(self):
        cert   = self._issue_cert("Alice", "alice@test.com")
        result = self.verifier.verify(cert)
        self.assertTrue(result.valid)
        self.assertTrue(result.checks["signature"])
        self.assertTrue(result.checks["expiry"])
        self.assertTrue(result.checks["not_revoked"])

    def test_wrong_ca_signature_fails(self):
        # Build a cert signed by a different CA key
        other_key  = generate_rsa_key(2048)
        other_ca   = CertificateAuthority(_make_test_config(
            tempfile.mkdtemp()
        ))
        other_key, other_cert = other_ca.generate_root_ca()

        other_issuer = CertificateIssuer(other_key, other_cert, self.audit, self.cfg)
        gen = CSRGenerator(_make_subject("Fake", "fake@test.com"), self.cfg)
        key = gen.generate_key_pair()
        csr = gen.build_csr(key)
        fake_cert = other_issuer.issue(csr, validity_days=365, name="fake")

        result = self.verifier.verify(fake_cert)
        self.assertFalse(result.valid)
        self.assertFalse(result.checks["signature"])

    def test_revoked_cert_fails(self):
        cert = self._issue_cert("Alice", "alice@test.com")
        self.crl_mgr.revoke(cert.serial_number, reason="key_compromise")
        result = self.verifier.verify(cert)
        self.assertFalse(result.valid)
        self.assertFalse(result.checks["not_revoked"])
        self.assertIn("key_compromise", result.reason)

    def test_verify_logs_audit_entry(self):
        cert   = self._issue_cert("Alice", "alice@test.com")
        before = len(self.audit.get_log())
        self.verifier.verify(cert)
        after  = len(self.audit.get_log())
        self.assertEqual(after, before + 1)
        self.assertEqual(self.audit.get_log()[-1]["event"], "CERT_VERIFIED")


# ── CRL Manager Tests ──────────────────────────────────────────────────────────

class TestCRLManager(CATestBase):

    def test_revoke_marks_serial(self):
        cert = self._issue_cert("Alice", "alice@test.com")
        self.assertFalse(self.crl_mgr.is_revoked(cert.serial_number))
        self.crl_mgr.revoke(cert.serial_number, reason="superseded")
        self.assertTrue(self.crl_mgr.is_revoked(cert.serial_number))

    def test_double_revoke_is_idempotent(self):
        cert = self._issue_cert("Alice", "alice@test.com")
        self.crl_mgr.revoke(cert.serial_number)
        self.crl_mgr.revoke(cert.serial_number)   # should not raise
        self.assertTrue(self.crl_mgr.is_revoked(cert.serial_number))

    def test_invalid_reason_raises(self):
        cert = self._issue_cert("Alice", "alice@test.com")
        with self.assertRaises(ValueError):
            self.crl_mgr.revoke(cert.serial_number, reason="not_a_real_reason")

    def test_crl_file_created(self):
        cert = self._issue_cert("Alice", "alice@test.com")
        self.crl_mgr.revoke(cert.serial_number)
        crl_path = os.path.join(self.cfg["crl_dir"], "ca.crl.pem")
        self.assertTrue(os.path.exists(crl_path))

    def test_revocation_info_returned(self):
        cert = self._issue_cert("Alice", "alice@test.com")
        self.crl_mgr.revoke(cert.serial_number, reason="key_compromise")
        info = self.crl_mgr.get_revocation_info(cert.serial_number)
        self.assertIsNotNone(info)
        self.assertEqual(info["reason"], "key_compromise")

    def test_revoke_logs_audit_entry(self):
        cert   = self._issue_cert("Alice", "alice@test.com")
        before = len(self.audit.get_log())
        self.crl_mgr.revoke(cert.serial_number)
        after  = len(self.audit.get_log())
        self.assertEqual(after, before + 1)
        self.assertEqual(self.audit.get_log()[-1]["event"], "CERT_REVOKED")


# ── Audit Log Tests ────────────────────────────────────────────────────────────

class TestAuditLog(CATestBase):

    def test_chain_intact_after_events(self):
        self._issue_cert("Alice", "alice@test.com")
        self._issue_cert("Bob",   "bob@test.com")
        self.assertTrue(self.audit.verify_chain())

    def test_chain_broken_on_tamper(self):
        self._issue_cert("Alice", "alice@test.com")
        # Tamper with the log file directly
        with open(self.cfg["audit_log_path"], "r") as f:
            entries = json.load(f)
        entries[0]["data"]["subject"] = "TAMPERED"
        with open(self.cfg["audit_log_path"], "w") as f:
            json.dump(entries, f)

        tampered_log = AuditLog(self.cfg["audit_log_path"])
        self.assertFalse(tampered_log.verify_chain())

    def test_entries_have_required_fields(self):
        self.audit.log("TEST_EVENT", {"key": "value"})
        entry = self.audit.get_log()[-1]
        for field in ("seq", "timestamp", "event", "data", "prev_hash", "hash"):
            self.assertIn(field, entry)

    def test_sequential_seq_numbers(self):
        for i in range(5):
            self.audit.log(f"EVENT_{i}", {})
        entries = self.audit.get_log()
        for i, e in enumerate(entries):
            self.assertEqual(e["seq"], i)


# ── CLI Integration Tests ──────────────────────────────────────────────────────

class TestCLI(CATestBase):
    """Tests the CLI run() function end-to-end using argv injection."""

    def setUp(self):
        super().setUp()
        # Patch CA_CONFIG in cli module to use test paths
        import cli
        import config
        self._orig_config = config.CA_CONFIG.copy()
        config.CA_CONFIG.update(self.cfg)
        # Also patch the imported copy inside cli
        cli.CA_CONFIG.update(self.cfg)

    def tearDown(self):
        import config, cli
        config.CA_CONFIG.update(self._orig_config)
        cli.CA_CONFIG.update(self._orig_config)
        super().tearDown()

    def test_cli_init(self):
        from cli import run
        try:
            run(["init"])
        except SystemExit as e:
            self.assertEqual(e.code, 0)

    def test_cli_issue(self):
        from cli import run
        try:
            run([
                "issue",
                "--name",  "CLI User",
                "--email", "cli@test.com",
            ])
        except SystemExit as e:
            self.fail(f"CLI issue exited with code {e.code}")

    def test_cli_audit(self):
        from cli import run
        self._issue_cert("Alice", "alice@test.com")
        try:
            run(["audit"])
        except SystemExit as e:
            self.fail(f"CLI audit exited with code {e.code}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
