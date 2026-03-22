"""
db/database.py — Engine, session factory, and DB initialisation.

Defaults to SQLite (zero-config for development).
Switch to PostgreSQL by setting DATABASE_URL env var:
    DATABASE_URL=postgresql://user:pass@localhost:5432/digital_ca
"""

import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from db.models import Base

# Resolve storage/ at project root: backend/db/database.py → go up 3 levels
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DEFAULT_DB   = f"sqlite:///{os.path.join(_PROJECT_ROOT, 'storage', 'ca_database.db')}"

DATABASE_URL = os.getenv("DATABASE_URL", _DEFAULT_DB)

# PostgreSQL needs pool_pre_ping; SQLite needs check_same_thread=False
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def init_db() -> None:
    """Create all tables if they don't exist yet."""
    # Ensure the storage directory exists before SQLite tries to open the file
    if DATABASE_URL.startswith("sqlite:///"):
        db_path = DATABASE_URL[len("sqlite:///"):]
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
