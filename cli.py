"""
cli.py — Digital CA command-line interface

Commands:
  init                     Initialize or load the Root CA
  issue   --name --email   Generate CSR + issue certificate
  verify  --cert           Verify a certificate file
  revoke  --serial         Revoke a certificate by serial number
  audit                    Print the audit log and verify chain integrity
  crl                      Rebuild and display the CRL
"""

import argparse
import sys
import os

from ca.ca_setup import CertificateAuthority
from ca.csr_generator import CSRGenerator
from ca.cert_issuer import CertificateIssuer
from ca.cert_verifier import CertificateVerifier
from ca.crl_manager import CRLManager, REASON_MAP
from audit.audit_log import AuditLog
from utils.crypto_utils import load_certificate
from config import CA_CONFIG
from logger import get_logger

logger = get_logger(__name__)


# ── Shared CA bootstrap ────────────────────────────────────────────────────────

def _bootstrap() -> tuple:
    """Load CA + shared services. Used by every command."""
    ca = CertificateAuthority()
    ca_key, ca_cert = ca.initialize()
    audit   = AuditLog(CA_CONFIG["audit_log_path"])
    crl_mgr = CRLManager(ca_key, ca_cert, audit)
    issuer  = CertificateIssuer(ca_key, ca_cert, audit)
    verifier = CertificateVerifier(ca_cert, crl_mgr, audit)
    return ca_key, ca_cert, audit, crl_mgr, issuer, verifier


# ── Command handlers ───────────────────────────────────────────────────────────

def cmd_init(_args) -> None:
    """Initialize or display the Root CA."""
    ca = CertificateAuthority()
    _, cert = ca.initialize()
    _print_cert("Root CA", cert)
    print("\n[OK] CA is ready.")


def cmd_issue(args) -> None:
    """Generate a CSR and issue a signed certificate."""
    _, _, audit, _, issuer, _ = _bootstrap()

    subject = {
        "common_name": args.name,
        "country":     args.country,
        "state":       args.state,
        "locality":    args.locality,
        "org":         args.org,
        "org_unit":    args.org_unit,
        "email":       args.email,
    }

    try:
        gen = CSRGenerator(subject)
        key = gen.generate_key_pair()
        csr = gen.build_csr(key)
        safe_name = args.name.lower().replace(" ", "_")
        gen.save(key, csr, name=safe_name)

        cert = issuer.issue(csr, validity_days=args.days, name=safe_name)
        _print_cert(f"Issued: {args.name}", cert)
        print(f"\n[OK] Certificate saved to: storage/certs/{safe_name}_{cert.serial_number}.pem")
        print(f"[OK] Serial number: {cert.serial_number}")

    except ValueError as e:
        logger.error("Issue failed: %s", e)
        print(f"\n[ERROR] {e}")
        sys.exit(1)


def cmd_verify(args) -> None:
    """Verify a certificate PEM file."""
    if not os.path.exists(args.cert):
        print(f"[ERROR] File not found: {args.cert}")
        sys.exit(1)

    _, _, _, _, _, verifier = _bootstrap()

    try:
        cert   = load_certificate(args.cert)
        result = verifier.verify(cert)
        _print_verify_result(result)

    except Exception as e:
        logger.error("Verify failed: %s", e)
        print(f"\n[ERROR] {e}")
        sys.exit(1)


def cmd_revoke(args) -> None:
    """Revoke a certificate by serial number."""
    _, _, _, crl_mgr, _, _ = _bootstrap()

    try:
        serial = int(args.serial)
        crl_mgr.revoke(serial, reason=args.reason)
        print(f"\n[OK] Serial {serial} revoked — reason: {args.reason}")
        print(f"[OK] CRL updated: storage/crl/ca.crl.pem")

    except ValueError as e:
        logger.error("Revoke failed: %s", e)
        print(f"\n[ERROR] {e}")
        sys.exit(1)


def cmd_audit(_args) -> None:
    """Print the audit log and verify chain integrity."""
    audit  = AuditLog(CA_CONFIG["audit_log_path"])
    intact = audit.verify_chain()
    entries = audit.get_log()

    print(f"\n{'=' * 60}")
    print(f"  AUDIT LOG  —  {len(entries)} entries")
    print(f"  Chain integrity: {'INTACT' if intact else '*** TAMPERED ***'}")
    print(f"{'=' * 60}")

    for e in entries:
        print(f"  [{e['seq']:03d}] {e['timestamp']}  {e['event']}")

    print(f"{'=' * 60}\n")

    if not intact:
        print("[CRITICAL] Audit chain has been tampered with!")
        sys.exit(2)


def cmd_crl(_args) -> None:
    """Rebuild the CRL and display revoked serials."""
    _, _, audit, crl_mgr, _, _ = _bootstrap()
    crl = crl_mgr.build_and_save_crl()

    revoked = list(crl)
    print(f"\n{'=' * 60}")
    print(f"  CRL  —  {len(revoked)} revoked certificate(s)")
    print(f"{'=' * 60}")

    if not revoked:
        print("  (no revoked certificates)")
    else:
        for r in revoked:
            print(f"  Serial : {r.serial_number}")
            print(f"  Date   : {r.revocation_date_utc}")
            print()

    print(f"{'=' * 60}\n")
    print("[OK] CRL saved to: storage/crl/ca.crl.pem")


# ── Display helpers ────────────────────────────────────────────────────────────

def _print_cert(label: str, cert) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {label}")
    print(f"{'=' * 60}")
    print(f"  Subject     : {cert.subject.rfc4514_string()}")
    print(f"  Issuer      : {cert.issuer.rfc4514_string()}")
    print(f"  Serial      : {cert.serial_number}")
    print(f"  Valid From  : {cert.not_valid_before_utc}")
    print(f"  Valid Until : {cert.not_valid_after_utc}")
    print(f"{'=' * 60}")


def _print_verify_result(result) -> None:
    status = "VALID" if result.valid else "INVALID"
    print(f"\n{'=' * 60}")
    print(f"  Verification Result: {status}")
    print(f"{'=' * 60}")
    print(f"  Subject : {result.subject}")
    print(f"  Serial  : {result.serial}")
    if result.reason:
        print(f"  Reason  : {result.reason}")
    print()
    for check, ok in result.checks.items():
        mark = "OK  " if ok else "FAIL"
        print(f"  [{mark}] {check}")
    print(f"{'=' * 60}\n")


# ── Argument parser ────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ca",
        description="Digital Certificate Authority CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py init
  python main.py issue --name "Alice" --email alice@example.com
  python main.py verify --cert storage/certs/alice_<serial>.pem
  python main.py revoke --serial <serial> --reason key_compromise
  python main.py audit
  python main.py crl
        """,
    )

    sub = parser.add_subparsers(dest="command", required=True)

    # init
    sub.add_parser("init", help="Initialize or display the Root CA")

    # issue
    p_issue = sub.add_parser("issue", help="Issue a new certificate")
    p_issue.add_argument("--name",     required=True,  help="Common name (e.g. 'Alice Smith')")
    p_issue.add_argument("--email",    required=True,  help="Email address")
    p_issue.add_argument("--org",      default="Example Corp",   help="Organization")
    p_issue.add_argument("--org-unit", default="Engineering",    dest="org_unit", help="Org unit")
    p_issue.add_argument("--country",  default="US",             help="2-letter country code")
    p_issue.add_argument("--state",    default="California",     help="State")
    p_issue.add_argument("--locality", default="San Francisco",  help="City")
    p_issue.add_argument("--days",     default=365, type=int,    help="Validity in days (default: 365)")

    # verify
    p_verify = sub.add_parser("verify", help="Verify a certificate file")
    p_verify.add_argument("--cert", required=True, help="Path to the .pem certificate file")

    # revoke
    p_revoke = sub.add_parser("revoke", help="Revoke a certificate by serial number")
    p_revoke.add_argument("--serial", required=True, help="Certificate serial number")
    p_revoke.add_argument(
        "--reason",
        default="unspecified",
        choices=list(REASON_MAP.keys()),
        help="Revocation reason (default: unspecified)",
    )

    # audit
    sub.add_parser("audit", help="Display and verify the audit log")

    # crl
    sub.add_parser("crl", help="Rebuild and display the Certificate Revocation List")

    return parser


def run(argv=None) -> None:
    parser = build_parser()
    args   = parser.parse_args(argv)

    dispatch = {
        "init":   cmd_init,
        "issue":  cmd_issue,
        "verify": cmd_verify,
        "revoke": cmd_revoke,
        "audit":  cmd_audit,
        "crl":    cmd_crl,
    }

    try:
        dispatch[args.command](args)
    except KeyboardInterrupt:
        print("\n[Interrupted]")
        sys.exit(0)
    except Exception as e:
        logger.exception("Unhandled error in command '%s'", args.command)
        print(f"\n[FATAL] {e}")
        sys.exit(1)
