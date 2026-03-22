# Digital Certificate Authority (Digital CA)

## What is this Project?

A **Digital Certificate Authority (CA)** is a trusted system that issues, manages, and revokes digital certificates — the same technology that powers the padlock icon in your browser when you visit a secure website (HTTPS).

This project is a **fully functional PKI (Public Key Infrastructure) system** built from scratch. It simulates how real-world certificate authorities like DigiCert, GlobalSign, or Let's Encrypt work internally — generating cryptographic key pairs, signing X.509 certificates, maintaining revocation lists, and automating certificate renewal.

The system is accessible through a modern **React web interface** backed by a **FastAPI REST API**, making it practical, visual, and easy to understand.

---

## Main Aim

The core goal of this project is to **demonstrate and implement the complete lifecycle of a digital certificate** in a real PKI environment:

1. **Root CA Setup** — Create a self-signed Root Certificate Authority with an RSA-2048 key pair, which acts as the ultimate trust anchor of the system.

2. **Certificate Issuance** — Generate a CSR (Certificate Signing Request) for any identity (person, server, application) and have the CA sign it into a valid X.509 v3 certificate.

3. **Certificate Verification** — Verify any certificate against three checks: signature validity, expiry window, and revocation status.

4. **Certificate Revocation** — Revoke compromised or expired certificates and maintain a signed Certificate Revocation List (CRL) that is checked during verification.

5. **PKI Hierarchy** — Implement a two-tier hierarchy (Root CA → Intermediate CA → End-entity certificate) which mirrors how real enterprise PKI systems are structured.

6. **OCSP** — Provide real-time certificate status checks via the Online Certificate Status Protocol (RFC 6960), the modern alternative to CRL polling.

7. **ACME Protocol** — Automate certificate issuance and renewal using the ACME protocol (RFC 8555) — the same protocol used by Let's Encrypt to issue millions of certificates automatically.

8. **Tamper-Evident Audit Log** — Record every CA operation in a hash-chained log where any tampering is immediately detectable, ensuring accountability and non-repudiation.

---

## What Makes This Project Unique?

Most PKI tools and tutorials either show only one piece of the puzzle (e.g. just generating a cert with OpenSSL) or are heavyweight enterprise systems that are difficult to understand or run locally. This project is different in several ways:

### 1. Complete End-to-End PKI in One Place
Unlike OpenSSL command-line tutorials that require memorising dozens of flags, or enterprise tools like EJBCA that need a full Java stack, this project covers the **entire certificate lifecycle** — from Root CA creation to ACME auto-renewal — in a single, self-contained system you can run locally in minutes.

### 2. Modern Web Interface
Most open-source CA tools are either CLI-only or have outdated interfaces. This project provides a **React-based dashboard** with 11 functional tabs, giving a visual and interactive way to understand every PKI operation — making it ideal for learning and demonstration.

### 3. Two-Tier PKI Hierarchy
Many educational PKI projects only implement a flat single-CA model. This project implements the **Root CA → Intermediate CA → End-entity** hierarchy used in production systems. The root key stays offline; the intermediate handles day-to-day issuance. If the intermediate is compromised, the root can revoke it without replacing the trust anchor.

### 4. Hash-Chained Audit Log
Every operation (certificate issued, revoked, verified) is recorded in a **hash-chained, tamper-evident audit log** — similar to a blockchain. Any modification to a past entry breaks the chain and is immediately detected. This is a security feature not found in most educational PKI implementations.

### 5. ACME Protocol Implementation
This project implements a **simplified but functional ACME protocol (RFC 8555)** — the same protocol Let's Encrypt uses. Most PKI projects skip this entirely. Here you can simulate the full ACME flow: order → challenge → validate → finalize → receive certificate, and check which certificates are due for renewal.

### 6. Certificate Templates
Rather than issuing generic certificates, this project supports **four purpose-specific templates** (client authentication, TLS server, email signing, code signing), each with the correct X.509 v3 extensions (Key Usage, Extended Key Usage, SAN) for its use case — matching how real CAs operate.

### 7. OCSP Responder
Implements a real **RFC 6960 OCSP responder** that returns DER-encoded signed responses. Browsers and TLS libraries can query this endpoint to check certificate status in real time, without downloading the entire CRL.

### 8. REST API + Multiple Interfaces
The system exposes a clean REST API, a React web UI, and a CLI — three different ways to interact with the same CA. This makes it useful as both a learning tool and a prototype for integrating certificate management into other systems.

### 9. LDAP / Active Directory Integration
Includes an optional **LDAP identity verification** step before issuing certificates — the CA can confirm that the requester actually exists in an enterprise directory before signing their certificate, mirroring real enterprise CA workflows.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Axios |
| Backend | Python, FastAPI, Uvicorn |
| Cryptography | Python `cryptography` library — RSA-2048, X.509 v3, SHA-256 |
| Database | SQLite (default) / PostgreSQL (optional via env var) |
| ORM | SQLAlchemy |
| Testing | pytest |

---

## Project Structure

```
digital_ca/
├── backend/                        ← Python / FastAPI
│   ├── api/
│   │   ├── routes/
│   │   │   ├── ca.py               ← POST /api/ca/init, GET /api/ca/status
│   │   │   ├── certs.py            ← Issue, list, verify, revoke
│   │   │   ├── crl.py              ← CRL get + rebuild
│   │   │   ├── audit.py            ← Audit log endpoints
│   │   │   ├── ocsp.py             ← OCSP responder (RFC 6960)
│   │   │   └── acme.py             ← ACME protocol (RFC 8555)
│   │   └── main.py                 ← FastAPI app entry point
│   ├── ca/
│   │   ├── ca_setup.py             ← Root CA initialisation
│   │   ├── cert_issuer.py          ← Signs CSRs → X.509 v3 certificates
│   │   ├── cert_verifier.py        ← Signature / expiry / revocation checks
│   │   ├── cert_templates.py       ← client_auth, tls_server, email_signing, code_signing
│   │   ├── crl_manager.py          ← Certificate Revocation List
│   │   ├── csr_generator.py        ← RSA key pair + PKCS#10 CSR generation
│   │   └── intermediate_ca.py      ← Root → Intermediate → End-entity hierarchy
│   ├── audit/
│   │   └── audit_log.py            ← Hash-chained tamper-evident audit log
│   ├── db/
│   │   ├── models.py               ← SQLAlchemy ORM models
│   │   └── database.py             ← SQLite engine + session factory
│   ├── integrations/
│   │   └── ldap_client.py          ← Optional LDAP / Active Directory lookup
│   ├── utils/
│   │   └── crypto_utils.py         ← Shared crypto helpers
│   ├── tests/
│   │   └── test_ca.py              ← Full pytest test suite (20+ tests)
│   ├── config.py                   ← All CA configuration
│   ├── logger.py                   ← Rotating file + coloured console logger
│   ├── cli.py                      ← Command-line interface
│   ├── main.py                     ← CLI entry point
│   └── requirements.txt
│
├── frontend/                       ← React + Vite
│   └── src/
│       ├── pages/
│       │   ├── InitCA.jsx          ← Initialise Root CA
│       │   ├── IssueCert.jsx       ← Issue certificate (all templates + SAN)
│       │   ├── Certificates.jsx    ← List all certs + detail lookup
│       │   ├── VerifyCert.jsx      ← Upload + verify a PEM file
│       │   ├── RevokeCert.jsx      ← Revoke by serial + reason
│       │   ├── AuditLog.jsx        ← Hash-chain audit log viewer
│       │   ├── CRL.jsx             ← CRL rebuild + revoked list
│       │   ├── IntermediateCA.jsx  ← Issue via Intermediate CA
│       │   ├── Templates.jsx       ← Certificate template reference
│       │   ├── ACME.jsx            ← ACME order + renewal check
│       │   └── OCSP.jsx            ← Real-time certificate status check
│       ├── api.js                  ← Axios wrapper for all API calls
│       ├── App.jsx                 ← Tab navigation shell
│       ├── index.css               ← Dark purple/cyan theme
│       └── main.jsx                ← React entry point
│
└── storage/                        ← Runtime-generated data (gitignored)
    ├── certs/                      ← Issued certificate PEM files
    ├── csr/                        ← CSR + private key PEM files
    ├── crl/                        ← CRL PEM + revocation registry JSON
    ├── audit/                      ← Audit log JSON + system log
    ├── ca_certificate.pem          ← Root CA certificate
    ├── ca_private_key.pem          ← Root CA private key (encrypted)
    └── ca_database.db              ← SQLite database
```

---

## Running the Project

### 1. Start the Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open in browser: http://localhost:5173

### 3. Run Tests

```bash
cd backend
pytest tests/test_ca.py -v
```

### 4. CLI (optional)

```bash
cd backend
python main.py init
python main.py issue --name "Alice" --email alice@example.com
python main.py verify --cert ../storage/certs/alice_<serial>.pem
python main.py revoke --serial <serial> --reason key_compromise
python main.py audit
python main.py crl
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ca/init` | Initialise Root CA |
| GET | `/api/ca/status` | Root CA certificate details |
| POST | `/api/certs/issue` | Issue a new certificate |
| GET | `/api/certs/` | List all issued certificates |
| GET | `/api/certs/{serial}` | Get certificate details by serial |
| POST | `/api/certs/verify` | Verify a PEM certificate (file upload) |
| POST | `/api/certs/revoke` | Revoke a certificate |
| GET | `/api/crl` | Get current CRL as PEM |
| POST | `/api/crl/rebuild` | Force-rebuild the CRL |
| GET | `/api/audit` | Get full audit log + chain integrity |
| GET | `/api/audit/verify` | Verify audit chain integrity only |
| POST | `/ocsp` | OCSP responder — DER format (RFC 6960) |
| GET | `/ocsp/status/{serial}` | OCSP status as JSON (debug) |
| POST | `/acme/order` | Create ACME certificate order |
| GET | `/acme/challenge/{token}` | Serve ACME http-01 challenge |
| POST | `/acme/challenge/{token}/validate` | Validate ACME challenge |
| POST | `/acme/finalize/{order_id}` | Submit CSR and get certificate |
| GET | `/acme/renewals/due` | List certificates expiring soon |

---

## Certificate Templates

| Template | Use Case | Key Usage | Default Validity |
|----------|----------|-----------|-----------------|
| `client_auth` | End-user / client authentication | Digital Signature, Key Encipherment | 365 days |
| `tls_server` | HTTPS server certificate | Digital Signature, Key Encipherment | 365 days |
| `email_signing` | S/MIME email signing + encryption | Digital Signature, Data Encipherment | 730 days |
| `code_signing` | Software / firmware signing | Digital Signature, Content Commitment | 365 days |
