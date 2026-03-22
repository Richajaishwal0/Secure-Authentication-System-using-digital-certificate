"""
ca/cert_templates.py — Certificate profiles / templates.

Each template defines the X.509 v3 extensions and default validity
appropriate for a specific use case.

Available templates:
  - client_auth   : end-user / client authentication (original behaviour)
  - tls_server    : HTTPS server certificate (adds SAN, serverAuth EKU)
  - email_signing : S/MIME email signing and encryption
  - code_signing  : Software / firmware code signing
"""

from dataclasses import dataclass, field
from cryptography import x509
from cryptography.x509.oid import ExtendedKeyUsageOID
from cryptography.x509 import AuthorityInformationAccess, AccessDescription, CRLDistributionPoints, DistributionPoint
from cryptography.x509.oid import AuthorityInformationAccessOID


@dataclass
class CertTemplate:
    name:             str
    description:      str
    default_days:     int
    key_usage:        dict          # kwargs for x509.KeyUsage
    extended_usages:  list          # list of ExtendedKeyUsageOID values
    extra_extensions: list = field(default_factory=list)  # pre-built x509 extension objects


# ── Template definitions ───────────────────────────────────────────────────────

CLIENT_AUTH = CertTemplate(
    name="client_auth",
    description="End-user client authentication and email protection",
    default_days=365,
    key_usage=dict(
        digital_signature=True, content_commitment=True, key_encipherment=True,
        data_encipherment=False, key_agreement=False, key_cert_sign=False,
        crl_sign=False, encipher_only=False, decipher_only=False,
    ),
    extended_usages=[
        ExtendedKeyUsageOID.CLIENT_AUTH,
        ExtendedKeyUsageOID.EMAIL_PROTECTION,
    ],
)

TLS_SERVER = CertTemplate(
    name="tls_server",
    description="TLS/HTTPS server certificate",
    default_days=365,
    key_usage=dict(
        digital_signature=True, content_commitment=False, key_encipherment=True,
        data_encipherment=False, key_agreement=False, key_cert_sign=False,
        crl_sign=False, encipher_only=False, decipher_only=False,
    ),
    extended_usages=[
        ExtendedKeyUsageOID.SERVER_AUTH,
        ExtendedKeyUsageOID.CLIENT_AUTH,
    ],
)

EMAIL_SIGNING = CertTemplate(
    name="email_signing",
    description="S/MIME email signing and encryption",
    default_days=730,
    key_usage=dict(
        digital_signature=True, content_commitment=True, key_encipherment=True,
        data_encipherment=True, key_agreement=False, key_cert_sign=False,
        crl_sign=False, encipher_only=False, decipher_only=False,
    ),
    extended_usages=[
        ExtendedKeyUsageOID.EMAIL_PROTECTION,
    ],
)

CODE_SIGNING = CertTemplate(
    name="code_signing",
    description="Software / firmware code signing",
    default_days=365,
    key_usage=dict(
        digital_signature=True, content_commitment=True, key_encipherment=False,
        data_encipherment=False, key_agreement=False, key_cert_sign=False,
        crl_sign=False, encipher_only=False, decipher_only=False,
    ),
    extended_usages=[
        ExtendedKeyUsageOID.CODE_SIGNING,
    ],
)

TEMPLATES: dict[str, CertTemplate] = {
    t.name: t for t in [CLIENT_AUTH, TLS_SERVER, EMAIL_SIGNING, CODE_SIGNING]
}


def get_template(name: str) -> CertTemplate:
    if name not in TEMPLATES:
        raise ValueError(f"Unknown template '{name}'. Choose from: {list(TEMPLATES)}")
    return TEMPLATES[name]


def apply_template(
    builder: x509.CertificateBuilder,
    template: CertTemplate,
    san_names: list[str] | None = None,
    ocsp_url: str | None = None,
    crl_url: str | None = None,
) -> x509.CertificateBuilder:
    """
    Apply a template's extensions to a CertificateBuilder.

    Args:
        builder:   partially-built CertificateBuilder
        template:  CertTemplate to apply
        san_names: list of DNS names / IP strings for TLS server certs
        ocsp_url:  OCSP responder URL to embed in AIA extension
        crl_url:   CRL distribution point URL to embed
    """
    builder = builder.add_extension(
        x509.BasicConstraints(ca=False, path_length=None), critical=True
    )
    builder = builder.add_extension(
        x509.KeyUsage(**template.key_usage), critical=True
    )
    if template.extended_usages:
        builder = builder.add_extension(
            x509.ExtendedKeyUsage(template.extended_usages), critical=False
        )

    # Subject Alternative Names — required for TLS server certs
    if san_names:
        san_list = []
        for name in san_names:
            if name.replace(".", "").replace(":", "").isdigit() or ":" in name:
                from ipaddress import ip_address
                san_list.append(x509.IPAddress(ip_address(name)))
            else:
                san_list.append(x509.DNSName(name))
        builder = builder.add_extension(
            x509.SubjectAlternativeName(san_list), critical=False
        )

    # Authority Information Access — OCSP URL so clients can check revocation in real time
    if ocsp_url:
        builder = builder.add_extension(
            AuthorityInformationAccess([
                AccessDescription(
                    AuthorityInformationAccessOID.OCSP,
                    x509.UniformResourceIdentifier(ocsp_url),
                )
            ]),
            critical=False,
        )

    # CRL Distribution Points — where clients can download the full CRL
    if crl_url:
        builder = builder.add_extension(
            CRLDistributionPoints([
                DistributionPoint(
                    full_name=[x509.UniformResourceIdentifier(crl_url)],
                    relative_name=None,
                    reasons=None,
                    crl_issuer=None,
                )
            ]),
            critical=False,
        )

    # Any extra extensions defined on the template
    for ext, critical in template.extra_extensions:
        builder = builder.add_extension(ext, critical=critical)

    return builder
