"""
api/routes/auth.py — Login and token validation.

POST /api/auth/login   — username + password → token
GET  /api/auth/me      — validate token → user info
"""

import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import User

router = APIRouter()

# In-memory token store: { token: user_id }
_tokens: dict[str, int] = {}


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _get_user_by_token(token: str, db: Session) -> User:
    user_id = _tokens.get(token)
    if not user_id:
        raise HTTPException(401, "Invalid or expired token.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(401, "User not found.")
    return user


def seed_default_users(db: Session):
    """Create default admin and employee accounts if none exist."""
    if db.query(User).count() == 0:
        db.add_all([
            User(username="admin",    password_hash=_hash("admin123"),    role="admin",    full_name="IT Admin"),
            User(username="employee", password_hash=_hash("employee123"), role="employee", full_name="Employee"),
        ])
        db.commit()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or user.password_hash != _hash(body.password):
        raise HTTPException(401, "Invalid username or password.")
    token = secrets.token_hex(32)
    _tokens[token] = user.id
    return {
        "token":     token,
        "role":      user.role,
        "username":  user.username,
        "full_name": user.full_name,
        "email":     user.email,
    }


@router.post("/logout")
def logout(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    _tokens.pop(token, None)
    return {"ok": True}


@router.get("/me")
def me(authorization: str = Header(default=""), db: Session = Depends(get_db)):
    token = authorization.removeprefix("Bearer ").strip()
    user  = _get_user_by_token(token, db)
    return {
        "role":      user.role,
        "username":  user.username,
        "full_name": user.full_name,
        "email":     user.email,
    }
