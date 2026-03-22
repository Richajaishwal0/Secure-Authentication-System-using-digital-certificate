"""
api/routes/policy.py — Certificate policy management.

GET    /api/policy/           — list all policies
POST   /api/policy/           — create or update a policy
GET    /api/policy/{template} — get policy for a template
DELETE /api/policy/{template} — delete a policy
POST   /api/policy/trigger/{job_id} — manually trigger scheduler job
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from db.database import get_db
from db.models import CertPolicy

router = APIRouter()


class PolicyIn(BaseModel):
    template:                 str
    max_validity_days:        int  = 365
    auto_renew:               bool = False
    renew_days_before_expiry: int  = 30
    warn_days_before_expiry:  int  = 30
    require_approval:         bool = False
    allowed_sans:             bool = True
    description:              Optional[str] = ""


@router.get("/")
def list_policies(db: Session = Depends(get_db)):
    policies = db.query(CertPolicy).all()
    return [_serialize(p) for p in policies]


@router.post("/")
def upsert_policy(body: PolicyIn, db: Session = Depends(get_db)):
    existing = db.query(CertPolicy).filter(CertPolicy.template == body.template).first()
    if existing:
        for k, v in body.model_dump().items():
            setattr(existing, k, v)
    else:
        existing = CertPolicy(**body.model_dump())
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return _serialize(existing)


@router.get("/{template}")
def get_policy(template: str, db: Session = Depends(get_db)):
    p = db.query(CertPolicy).filter(CertPolicy.template == template).first()
    if not p:
        raise HTTPException(404, f"No policy for template '{template}'")
    return _serialize(p)


@router.delete("/{template}")
def delete_policy(template: str, db: Session = Depends(get_db)):
    p = db.query(CertPolicy).filter(CertPolicy.template == template).first()
    if not p:
        raise HTTPException(404, f"No policy for template '{template}'")
    db.delete(p)
    db.commit()
    return {"deleted": template}


@router.post("/trigger/{job_id}")
def trigger_job(job_id: str):
    from automation.scheduler import trigger_now
    ok = trigger_now(job_id)
    if not ok:
        raise HTTPException(404, f"Job '{job_id}' not found. Valid: expiry_check, auto_renew")
    return {"triggered": job_id}


def _serialize(p: CertPolicy):
    return {
        "template":                 p.template,
        "max_validity_days":        p.max_validity_days,
        "auto_renew":               p.auto_renew,
        "renew_days_before_expiry": p.renew_days_before_expiry,
        "warn_days_before_expiry":  p.warn_days_before_expiry,
        "require_approval":         p.require_approval,
        "allowed_sans":             p.allowed_sans,
        "description":              p.description,
    }
