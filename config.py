import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")

CA_CONFIG = {
    # X.509 Subject fields
    "country":          "US",
    "state":            "California",
    "locality":         "San Francisco",
    "org":              "MyCA Organization",
    "org_unit":         "IT Security",
    "common_name":      "MyCA Root Certificate Authority",
    "email":            "ca-admin@myca.local",

    # Key settings
    "key_size":         2048,
    "key_password":     b"change-this-in-production",   # encrypt private key at rest

    # Certificate validity
    "validity_days":    3650,                            # 10 years for root CA

    # Storage paths
    "ca_key_path":      os.path.join(STORAGE_DIR, "ca_private_key.pem"),
    "ca_cert_path":     os.path.join(STORAGE_DIR, "ca_certificate.pem"),
    "certs_dir":        os.path.join(STORAGE_DIR, "certs"),
    "crl_dir":          os.path.join(STORAGE_DIR, "crl"),
    "csr_dir":          os.path.join(STORAGE_DIR, "csr"),
    "audit_log_path":   os.path.join(STORAGE_DIR, "audit", "audit_log.json"),
}
