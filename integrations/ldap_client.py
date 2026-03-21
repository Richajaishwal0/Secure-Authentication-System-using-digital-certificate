"""
integrations/ldap_client.py — LDAP / Active Directory identity lookup.

Before issuing a certificate, the CA can verify the requester's identity
against an LDAP directory (e.g. Active Directory, OpenLDAP).

Real-world use:
  - Enterprise CA checks that "Rahul" with email "rahul@corp.com" actually
    exists in Active Directory before signing their certificate.
  - Prevents issuing certs to non-existent or terminated employees.

Configuration (via environment variables or config.py):
    LDAP_ENABLED=true
    LDAP_SERVER=ldap://ldap.example.com:389
    LDAP_BASE_DN=dc=example,dc=com
    LDAP_BIND_DN=cn=admin,dc=example,dc=com
    LDAP_BIND_PASS=secret
    LDAP_USER_ATTR=uid   (or 'mail' for AD)
"""

from config import LDAP_CONFIG
from logger import get_logger

logger = get_logger(__name__)


class LDAPClient:
    """
    Wraps ldap3 for user identity lookups.
    Falls back gracefully if LDAP is disabled or unavailable.
    """

    def __init__(self, config: dict = None):
        self.config  = config or LDAP_CONFIG
        self.enabled = self.config.get("enabled", False)

    def lookup_user(self, email: str) -> dict | None:
        """
        Search for a user by email in the LDAP directory.

        Returns a dict with user attributes if found, None otherwise.
        If LDAP is disabled, returns a stub dict (allows issuance to proceed).
        """
        if not self.enabled:
            logger.info("LDAP disabled — skipping identity lookup for '%s'", email)
            return {"email": email, "source": "ldap_disabled"}

        try:
            import ldap3
            server = ldap3.Server(self.config["server"], get_info=ldap3.ALL)
            conn   = ldap3.Connection(
                server,
                user=self.config["bind_dn"],
                password=self.config["bind_pass"],
                auto_bind=True,
            )

            search_filter = f"(mail={email})"
            conn.search(
                search_base=self.config["base_dn"],
                search_filter=search_filter,
                attributes=["cn", "mail", "o", "ou", "c", "st", "l"],
            )

            if not conn.entries:
                logger.warning("LDAP: no user found for email '%s'", email)
                return None

            entry = conn.entries[0]
            result = {
                "email":      str(entry.mail)   if entry.mail   else email,
                "cn":         str(entry.cn)      if entry.cn     else "",
                "org":        str(entry.o)       if entry.o      else "",
                "org_unit":   str(entry.ou)      if entry.ou     else "",
                "country":    str(entry.c)       if entry.c      else "",
                "state":      str(entry.st)      if entry.st     else "",
                "locality":   str(entry.l)       if entry.l      else "",
                "source":     "ldap",
            }
            logger.info("LDAP: found user '%s' for email '%s'", result["cn"], email)
            return result

        except ImportError:
            logger.warning("ldap3 not installed — LDAP lookup skipped. pip install ldap3")
            return {"email": email, "source": "ldap3_not_installed"}
        except Exception as e:
            logger.error("LDAP lookup failed for '%s': %s", email, e)
            return None

    def verify_user_exists(self, email: str) -> bool:
        """Simple boolean check — does this user exist in the directory?"""
        return self.lookup_user(email) is not None

    def enrich_subject(self, subject: dict) -> dict:
        """
        Look up the user and fill in any missing subject fields from LDAP.
        Useful when the requester only provides an email.
        """
        if not self.enabled:
            return subject

        user = self.lookup_user(subject.get("email", ""))
        if not user:
            return subject

        enriched = dict(subject)
        for field in ["org", "org_unit", "country", "state", "locality"]:
            if not enriched.get(field) and user.get(field):
                enriched[field] = user[field]
        if not enriched.get("common_name") and user.get("cn"):
            enriched["common_name"] = user["cn"]

        logger.info("Subject enriched from LDAP for '%s'", subject.get("email"))
        return enriched
