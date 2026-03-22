"""
utils/email_sender.py — Send certificate delivery emails via SendGrid REST API.
Attaches both the certificate PEM and the private key PEM so the employee
has everything needed to use the certificate.
"""

import base64
import requests

import config as _cfg_module
from logger import get_logger

logger = get_logger(__name__)

SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send"


def send_certificate_email(
    to_email:        str,
    to_name:         str,
    message:         str,
    pem:             str,
    cert_serial:     str,
    template:        str,
    not_after:       str,
    private_key_pem: str | None = None,
    override_cfg:    dict = None,
) -> dict:
    """
    Send an email with the certificate PEM and private key PEM as attachments.
    Returns {"sent": True} or {"sent": False, "error": "..."}.
    """
    cfg = override_cfg or _cfg_module.SENDGRID_CONFIG
    if not cfg["enabled"]:
        return {"sent": False, "error": "Email delivery not configured. Enable it in Settings."}
    if not cfg["api_key"]:
        return {"sent": False, "error": "SendGrid API key missing."}
    if not cfg["from_email"]:
        return {"sent": False, "error": "From address missing."}

    safe_name   = to_name.replace(' ', '_')
    serial_short = cert_serial[:8]

    body_text = message or (
        f"Hi {to_name},\n\n"
        f"Your digital certificate is ready. Two files are attached:\n"
        f"  1. {safe_name}_{serial_short}.pem  — your certificate (public, share freely)\n"
        f"  2. {safe_name}_{serial_short}_private_key.pem  — your PRIVATE KEY (keep this secret!)\n\n"
        f"Certificate type : {template}\n"
        f"Valid until       : {not_after[:10] if not_after else 'N/A'}\n\n"
        f"IMPORTANT: Keep your private key file safe. Do not share it with anyone.\n"
        f"If it is lost or compromised, contact IT immediately to revoke and reissue.\n"
    )

    attachments = [{
        "content":     base64.b64encode(pem.encode()).decode(),
        "type":        "application/x-pem-file",
        "filename":    f"{safe_name}_{serial_short}.pem",
        "disposition": "attachment",
    }]

    if private_key_pem:
        attachments.append({
            "content":     base64.b64encode(private_key_pem.encode()).decode(),
            "type":        "application/x-pem-file",
            "filename":    f"{safe_name}_{serial_short}_private_key.pem",
            "disposition": "attachment",
        })

    payload = {
        "personalizations": [{"to": [{"email": to_email, "name": to_name}]}],
        "from":       {"email": cfg["from_email"]},
        "subject":    f"Your Digital Certificate is Ready — {template}",
        "content":    [{"type": "text/plain", "value": body_text}],
        "attachments": attachments,
    }

    try:
        resp = requests.post(
            SENDGRID_URL,
            json=payload,
            headers={"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"},
            timeout=10,
        )
        if resp.status_code in (200, 202):
            logger.info("Certificate email sent to %s (key attached: %s)", to_email, bool(private_key_pem))
            return {"sent": True}
        error = resp.json().get("errors", [{}])[0].get("message", resp.text)
        logger.error("SendGrid error for %s: %s", to_email, error)
        return {"sent": False, "error": error}
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return {"sent": False, "error": str(e)}
