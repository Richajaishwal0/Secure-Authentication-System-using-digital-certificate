import os

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")

CA_CONFIG = {
    # X.509 Subject fields
    "country":          "India",
    "state":            "TamilNadu",
    "locality":         "ABC",
    "org":              "MyCA Organization",
    "org_unit":         "IT Security",
    "common_name":      "MyCA Root Certificate Authority",
    "email":            "ca-admin@myca.local",

    # Key settings
    "key_size":         2048,
    "key_password":     b"change-this-in-production",

    # Certificate validity
    "validity_days":    3650,   # 10 years for root CA

    # Storage paths
    "ca_key_path":      os.path.join(STORAGE_DIR, "ca_private_key.pem"),
    "ca_cert_path":     os.path.join(STORAGE_DIR, "ca_certificate.pem"),
    "certs_dir":        os.path.join(STORAGE_DIR, "certs"),
    "crl_dir":          os.path.join(STORAGE_DIR, "crl"),
    "csr_dir":          os.path.join(STORAGE_DIR, "csr"),
    "audit_log_path":   os.path.join(STORAGE_DIR, "audit", "audit_log.json"),
}

# Intermediate CA — signed by Root, used for day-to-day issuance
INTERMEDIATE_CONFIG = {
    "country":          "US",
    "state":            "California",
    "locality":         "San Francisco",
    "org":              "MyCA Organization",
    "org_unit":         "IT Security",
    "common_name":      "MyCA Intermediate CA",
    "email":            "intermediate@myca.local",

    "key_size":         2048,
    "key_password":     b"intermediate-key-password",
    "validity_days":    1825,   # 5 years for intermediate

    "key_path":         os.path.join(STORAGE_DIR, "intermediate_private_key.pem"),
    "cert_path":        os.path.join(STORAGE_DIR, "intermediate_certificate.pem"),
}

# OCSP responder URL embedded in issued certificates
OCSP_URL = os.getenv("OCSP_URL", "http://localhost:8000/ocsp")

# LDAP configuration (optional — set env vars to enable)
LDAP_CONFIG = {
    "enabled":   os.getenv("LDAP_ENABLED", "false").lower() == "true",
    "server":    os.getenv("LDAP_SERVER",   "ldap://localhost:389"),
    "base_dn":   os.getenv("LDAP_BASE_DN",  "dc=example,dc=com"),
    "bind_dn":   os.getenv("LDAP_BIND_DN",  "cn=admin,dc=example,dc=com"),
    "bind_pass": os.getenv("LDAP_BIND_PASS", ""),
    "user_attr": os.getenv("LDAP_USER_ATTR", "uid"),
}
