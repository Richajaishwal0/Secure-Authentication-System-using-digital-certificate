"""
db/models.py — SQLAlchemy ORM models for the CA database.

Tables:
  - certificates      : every issued certificate
  - revoked_certs     : revocation registry (replaces revoked_registry.json)
  - audit_entries     : audit log (replaces audit_log.json)
  - acme_challenges   : ACME http-01 challenge state
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, BigInteger, String, Boolean,
    DateTime, Text, ForeignKey, Index
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Certificate(Base):
    __tablename__ = "certificates"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    serial        = Column(String(80), unique=True, nullable=False, index=True)
    common_name   = Column(String(256), nullable=False)
    email         = Column(String(256), nullable=False)
    org           = Column(String(256))
    org_unit      = Column(String(256))
    country       = Column(String(4))
    state         = Column(String(128))
    locality      = Column(String(128))
    template      = Column(String(64), default="client_auth")   # cert template used
    issued_by     = Column(String(64), default="root")          # "root" or "intermediate"
    not_before    = Column(DateTime(timezone=True), nullable=False)
    not_after     = Column(DateTime(timezone=True), nullable=False)
    pem           = Column(Text, nullable=False)                 # full PEM text
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    revocation    = relationship("RevokedCert", back_populates="certificate", uselist=False)

    __table_args__ = (
        Index("ix_cert_email", "email"),
        Index("ix_cert_common_name", "common_name"),
    )


class RevokedCert(Base):
    __tablename__ = "revoked_certs"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    serial      = Column(String(80), ForeignKey("certificates.serial"), unique=True, nullable=False, index=True)
    reason      = Column(String(64), nullable=False, default="unspecified")
    revoked_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    certificate = relationship("Certificate", back_populates="revocation")


class AuditEntry(Base):
    __tablename__ = "audit_entries"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    seq         = Column(Integer, unique=True, nullable=False)
    timestamp   = Column(String(64), nullable=False)
    event       = Column(String(64), nullable=False)
    data        = Column(Text, nullable=False)       # JSON string
    prev_hash   = Column(String(64), nullable=False)
    hash        = Column(String(64), nullable=False)

    __table_args__ = (Index("ix_audit_event", "event"),)


class AcmeChallenge(Base):
    __tablename__ = "acme_challenges"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    token       = Column(String(128), unique=True, nullable=False, index=True)
    account_key = Column(Text, nullable=False)       # JWK JSON of account public key
    domain      = Column(String(256), nullable=False)
    key_auth    = Column(String(256), nullable=False) # token.thumbprint
    status      = Column(String(32), default="pending")  # pending | valid | invalid
    expires_at  = Column(DateTime(timezone=True), nullable=False)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
