import os
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.x509 import Certificate, CertificateSigningRequest


def generate_rsa_key(key_size: int = 2048) -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(
        public_exponent=65537,
        key_size=key_size,
    )


def serialize_private_key(key: rsa.RSAPrivateKey, password: bytes) -> bytes:
    return key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.BestAvailableEncryption(password),
    )


def serialize_public_key(key: rsa.RSAPublicKey) -> bytes:
    return key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )


def serialize_cert(cert: Certificate) -> bytes:
    return cert.public_bytes(serialization.Encoding.PEM)


def serialize_csr(csr: CertificateSigningRequest) -> bytes:
    return csr.public_bytes(serialization.Encoding.PEM)


def load_private_key(path: str, password: bytes) -> rsa.RSAPrivateKey:
    with open(path, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=password)


def load_certificate(path: str) -> Certificate:
    from cryptography import x509
    with open(path, "rb") as f:
        return x509.load_pem_x509_certificate(f.read())


def load_csr(path: str) -> CertificateSigningRequest:
    from cryptography import x509
    with open(path, "rb") as f:
        return x509.load_pem_x509_csr(f.read())


def save_file(path: str, data: bytes, mode: int = 0o600) -> None:
    """Write bytes to path and apply restrictive file permissions."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    os.chmod(path, mode)
