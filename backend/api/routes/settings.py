"""
api/routes/settings.py — SendGrid email configuration.

GET  /api/settings/smtp        — get current config (api_key masked)
POST /api/settings/smtp        — save config to .env file
POST /api/settings/smtp/test   — send a test email
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), ".env")


class EmailConfig(BaseModel):
    enabled:    bool = False
    api_key:    str  = ""
    from_email: str  = ""


def _read_env() -> dict:
    env = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    env[k.strip()] = v.strip()
    return env


def _write_env(updates: dict):
    env = _read_env()
    env.update(updates)
    with open(ENV_PATH, "w") as f:
        for k, v in env.items():
            f.write(f"{k}={v}\n")


@router.get("/smtp")
def get_smtp():
    env = _read_env()
    return {
        "enabled":       env.get("SENDGRID_ENABLED", "false").lower() == "true",
        "api_key":       "",  # never send to frontend
        "_has_api_key":  bool(env.get("SENDGRID_API_KEY")),
        "from_email":    env.get("SENDGRID_FROM_EMAIL", ""),
    }


@router.post("/smtp")
def save_smtp(body: EmailConfig):
    updates = {
        "SENDGRID_ENABLED":    "true" if body.enabled else "false",
        "SENDGRID_FROM_EMAIL": body.from_email,
    }
    if body.api_key:
        updates["SENDGRID_API_KEY"] = body.api_key

    _write_env(updates)

    import config as cfg_module
    env = _read_env()
    cfg_module.SENDGRID_CONFIG.update({
        "enabled":    env.get("SENDGRID_ENABLED", "false").lower() == "true",
        "api_key":    env.get("SENDGRID_API_KEY", ""),
        "from_email": env.get("SENDGRID_FROM_EMAIL", ""),
    })

    return {"saved": True}


@router.post("/smtp/test")
def test_smtp(body: EmailConfig):
    if not body.api_key or not body.from_email:
        raise HTTPException(400, "Provide API key and From Address to test.")

    from utils.email_sender import send_certificate_email
    result = send_certificate_email(
        to_email     = body.from_email,
        to_name      = "Admin",
        message      = "This is a test email from your Digital CA system. SendGrid is configured correctly.",
        pem          = "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----",
        cert_serial  = "TEST123",
        template     = "test",
        not_after    = "2026-01-01",
        override_cfg = {
            "enabled":    True,
            "api_key":    body.api_key,
            "from_email": body.from_email,
        },
    )
    if not result["sent"]:
        raise HTTPException(400, result.get("error", "Test failed."))
    return {"sent": True}
