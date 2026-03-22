"""
automation/scheduler.py — Background scheduler for automated PKI lifecycle management.

Jobs:
  - expiry_check  : runs daily, finds certs expiring within policy window
  - auto_renew    : re-issues certs that have auto_renew=True in their policy
"""

import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from db.database import SessionLocal
from db.models import Certificate, RevokedCert, CertPolicy, RenewalLog
from ca.ca_setup import CertificateAuthority
from ca.csr_generator import CSRGenerator
from ca.cert_issuer import CertificateIssuer
from audit.audit_log import AuditLog
from config import CA_CONFIG

logger = logging.getLogger(__name__)

_scheduler = BackgroundScheduler(timezone="Asia/Kolkata")


# ── Core jobs ──────────────────────────────────────────────────────────────────

def expiry_check_job():
    """Flag certificates expiring within their policy warning window."""
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        active_certs = (
            db.query(Certificate)
            .outerjoin(RevokedCert, Certificate.serial == RevokedCert.serial)
            .filter(RevokedCert.serial == None)  # noqa: E711
            .filter(Certificate.not_after > now)
            .all()
        )

        for cert in active_certs:
            policy = _get_policy(db, cert.template)
            warn_days = policy.warn_days_before_expiry if policy else 30
            days_left = (cert.not_after - now).days
            if days_left <= warn_days:
                logger.warning(
                    "EXPIRY_WARNING serial=%s cn=%s days_left=%d",
                    cert.serial, cert.common_name, days_left,
                )

        logger.info("Expiry check complete — %d active certs scanned.", len(active_certs))
    except Exception as e:
        logger.error("expiry_check_job failed: %s", e)
    finally:
        db.close()


def auto_renew_job():
    """Auto-renew certificates whose policy has auto_renew=True and are near expiry."""
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        active_certs = (
            db.query(Certificate)
            .outerjoin(RevokedCert, Certificate.serial == RevokedCert.serial)
            .filter(RevokedCert.serial == None)  # noqa: E711
            .filter(Certificate.not_after > now)
            .all()
        )

        renewed = 0
        for cert in active_certs:
            policy = _get_policy(db, cert.template)
            if not policy or not policy.auto_renew:
                continue

            days_left = (cert.not_after - now).days

            if days_left <= policy.renew_days_before_expiry:
                _renew_certificate(db, cert, policy)
                renewed += 1

        logger.info("Auto-renew job complete — %d certs renewed.", renewed)
    except Exception as e:
        logger.error("auto_renew_job failed: %s", e)
    finally:
        db.close()


# ── Renewal logic ──────────────────────────────────────────────────────────────

def _renew_certificate(db: Session, cert: Certificate, policy: "CertPolicy"):
    """Revoke old cert and issue a fresh one with the same subject."""
    try:
        ca = CertificateAuthority()
        ca_key, ca_cert = ca.initialize()
        audit = AuditLog(CA_CONFIG["audit_log_path"])

        # Revoke old cert
        from ca.crl_manager import CRLManager
        crl_mgr = CRLManager(ca_key, ca_cert, audit)
        serial_int = int(cert.serial)
        if not crl_mgr.is_revoked(serial_int):
            crl_mgr.revoke(serial_int, reason="superseded")
            existing = db.query(RevokedCert).filter(RevokedCert.serial == cert.serial).first()
            if not existing:
                db.add(RevokedCert(serial=cert.serial, reason="superseded"))

        # Re-issue with same subject
        subject = {
            "common_name": cert.common_name,
            "email":       cert.email,
            "org":         cert.org or "",
            "org_unit":    cert.org_unit or "",
            "country":     cert.country or "US",
            "state":       cert.state or "",
            "locality":    cert.locality or "",
        }
        safe_name = cert.common_name.lower().replace(" ", "_")
        gen = CSRGenerator(subject)
        key = gen.generate_key_pair()
        csr = gen.build_csr(key)
        gen.save(key, csr, name=safe_name)

        validity = policy.max_validity_days if policy else 365
        issuer = CertificateIssuer(ca_key, ca_cert, audit, db=db)
        new_cert = issuer.issue(csr, validity, safe_name, cert.template)

        # Log renewal
        db.add(RenewalLog(
            old_serial=cert.serial,
            new_serial=str(new_cert.serial_number),
            common_name=cert.common_name,
            trigger="auto",
        ))
        db.commit()

        logger.info("Auto-renewed: %s → new serial %s", cert.serial, new_cert.serial_number)
    except Exception as e:
        db.rollback()
        logger.error("Failed to renew cert %s: %s", cert.serial, e)


def _get_policy(db: Session, template: str):
    return db.query(CertPolicy).filter(CertPolicy.template == template).first()


# ── Scheduler lifecycle ────────────────────────────────────────────────────────

def start_scheduler():
    if _scheduler.running:
        return
    _scheduler.add_job(expiry_check_job, IntervalTrigger(hours=24), id="expiry_check", replace_existing=True)
    _scheduler.add_job(auto_renew_job,   IntervalTrigger(hours=24), id="auto_renew",   replace_existing=True)
    _scheduler.start()
    logger.info("PKI automation scheduler started.")


def stop_scheduler():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("PKI automation scheduler stopped.")


def trigger_now(job_id: str):
    """Manually trigger a job by id — used by API endpoints."""
    job = _scheduler.get_job(job_id)
    if job:
        job.modify(next_run_time=datetime.now(IST))
        return True
    return False
