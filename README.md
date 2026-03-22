# DigitalCA: A Lightweight PKI System with Automated Lifecycle Management and Tamper-Evident Auditing for Small Organizations

## The Problem

Small organizations — startups, clinics, schools, small IT teams — face a real but often ignored security problem:

- They need digital certificates for employee VPN access, internal HTTPS servers, email signing, and code signing
- Enterprise CA tools (Microsoft ADCS, DigiCert, Venafi) are expensive and complex to operate
- Without proper tooling, certificates are managed manually in spreadsheets — or not managed at all
- Certificates expire silently, breaking services and creating security gaps
- There is no self-service — every certificate request goes through a single IT admin, creating a bottleneck
- When an employee leaves, their certificate may never be revoked
- There is no audit trail of who issued what and when

**This project solves all of the above** — a self-hosted, self-managing Certificate Authority built specifically for small organizations that need proper PKI without the enterprise price tag.

---

## What It Does

### 1. Full Certificate Lifecycle Management
- Creates a Root CA and an Intermediate CA (two-tier PKI hierarchy)
- Issues X.509 v3 certificates using 4 purpose-specific templates
- Verifies certificates — checks signature validity, expiry, and revocation status
- Revokes certificates with reason codes and maintains a signed Certificate Revocation List (CRL)

### 2. Automated Certificate Renewal
- A background scheduler runs daily and scans all active certificates
- Certificates with `auto_renew` enabled are automatically re-issued before they expire
- The old certificate is revoked and replaced — no human intervention needed
- Renewal history is logged and visible on the dashboard

### 3. Policy-Driven Lifecycle
- Admins define per-template policies: max validity, auto-renewal window, expiry warning window, approval requirements
- The system enforces these policies automatically at issuance and renewal
- Example: `code_signing` certificates require admin approval; `client_auth` certificates are auto-approved

### 4. Self-Service Request Portal
- Employees submit certificate requests through a simple form — no PKI knowledge required
- They choose what they need (VPN, email, web, code signing) in plain English
- Requests go into an admin approval queue; policies can auto-approve low-risk templates
- Admins approve or reject with a reason from the same interface

### 5. Two Distinct User Interfaces
- **Employee Portal** — simplified 3-screen view: request a certificate, view my certificates, check a certificate
- **Admin Panel** — full management: dashboard, issue, verify, revoke, CRL, audit log, policy manager, request queue

### 6. Real-Time Certificate Status (OCSP)
- Implements an RFC 6960 OCSP responder
- Any browser or TLS client can query the endpoint to check if a certificate is valid or revoked in real time
- Returns DER-encoded signed OCSP responses

### 7. ACME Protocol for Internal Servers
- Implements a simplified RFC 8555 ACME flow
- Internal servers can automatically request and renew TLS certificates without manual admin involvement
- Same protocol used by Let's Encrypt — adapted for internal/private CA use

### 8. Tamper-Evident Audit Log
- Every CA operation (issue, revoke, verify, renew) is recorded in a hash-chained log
- Each entry contains a SHA-256 hash of the previous entry — any modification breaks the chain
- Chain integrity can be verified at any time from the admin panel

### 9. LDAP / Active Directory Integration
- Before issuing a certificate, the CA can verify the requester exists in the company's employee directory
- Prevents issuing certificates to ex-employees or non-existent identities
- Configurable via environment variables; gracefully disabled if not needed

### 10. Live Dashboard
- Shows total, active, revoked, expired, and expiring-soon certificate counts
- CA health indicator with days remaining until root CA expiry
- Expiring certificates list filterable by 7, 14, 30, 60, or 90 days
- Manual trigger buttons for expiry check and auto-renew jobs
- Recent renewal log

---

## Problems Solved

| Problem | Solution |
|---|---|
| Can't afford enterprise CA tools | Fully self-hosted, runs locally, zero licensing cost |
| Certificates expire silently, services break | Auto-renewal scheduler re-issues certificates before expiry |
| IT admin manually tracks every certificate | Dashboard + policies automate monitoring and renewal |
| Employees need IT help for every cert request | Self-service portal — employees request certificates themselves |
| No audit trail of CA operations | Tamper-evident hash-chained audit log |
| Certificates issued to ex-employees | LDAP integration verifies identity against employee directory before issuing |
| Internal servers need HTTPS without paying for certs | Self-hosted CA issues TLS certs for internal domains via ACME |
| No way to instantly check if a cert is still valid | OCSP responder answers real-time status queries |
| High-risk cert types need human review | Per-template approval policies — some auto-approve, some require admin sign-off |

---

## Certificate Templates

| Template | Use Case | Key Usage | Default Validity |
|---|---|---|---|
| `client_auth` | Employee VPN access, internal system login | Digital Signature, Key Encipherment | 365 days |
| `tls_server` | Internal HTTPS websites and APIs | Digital Signature, Key Encipherment | 365 days |
| `email_signing` | S/MIME email signing and encryption | Digital Signature, Data Encipherment | 730 days |
| `code_signing` | Signing scripts and deployment software | Digital Signature, Content Commitment | 365 days |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Axios |
| Backend | Python, FastAPI, Uvicorn |
| Cryptography | Python `cryptography` library — RSA-2048, X.509 v3, SHA-256 |
| Database | SQLite (default) / PostgreSQL (optional) |
| ORM | SQLAlchemy |
| Scheduler | APScheduler |
| Testing | pytest, httpx |

---

## Project Structure

```
digital_ca/
├── backend/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── ca.py           ← POST /api/ca/init, GET /api/ca/status
│   │   │   ├── certs.py        ← Issue, list, verify, revoke
│   │   │   ├── crl.py          ← CRL get + rebuild
│   │   │   ├── audit.py        ← Audit log endpoints
│   │   │   ├── ocsp.py         ← OCSP responder (RFC 6960)
│   │   │   ├── acme.py         ← ACME protocol (RFC 8555)
│   │   │   ├── policy.py       ← Certificate policy management
│   │   │   ├── requests.py     ← Self-service request + admin approval queue
│   │   │   └── dashboard.py    ← Stats, expiring certs, renewal log
│   │   └── main.py             ← FastAPI app, router registration, scheduler startup
│   ├── ca/
│   │   ├── ca_setup.py         ← Root CA initialisation
│   │   ├── cert_issuer.py      ← Signs CSRs → X.509 v3 certificates
│   │   ├── cert_verifier.py    ← Signature / expiry / revocation checks
│   │   ├── cert_templates.py   ← client_auth, tls_server, email_signing, code_signing
│   │   ├── crl_manager.py      ← Certificate Revocation List
│   │   ├── csr_generator.py    ← RSA key pair + PKCS#10 CSR generation
│   │   └── intermediate_ca.py  ← Root → Intermediate → End-entity hierarchy
│   ├── audit/
│   │   └── audit_log.py        ← Hash-chained tamper-evident audit log
│   ├── automation/
│   │   └── scheduler.py        ← APScheduler jobs: expiry_check, auto_renew
│   ├── db/
│   │   ├── models.py           ← Certificate, RevokedCert, CertPolicy, CertRequest, RenewalLog, AcmeChallenge
│   │   └── database.py         ← SQLite engine + session factory
│   ├── integrations/
│   │   └── ldap_client.py      ← Optional LDAP / Active Directory identity lookup
│   ├── utils/
│   │   └── crypto_utils.py     ← Shared crypto helpers
│   ├── tests/
│   │   └── test_ca.py          ← pytest test suite
│   ├── config.py               ← CA configuration and paths
│   ├── logger.py               ← Rotating file + coloured console logger
│   ├── cli.py                  ← Command-line interface
│   ├── main.py                 ← CLI entry point
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx       ← Live stats, expiring certs, automation controls
│       │   ├── InitCA.jsx          ← Initialise Root CA
│       │   ├── IssueCert.jsx       ← Issue certificate (all templates + SAN)
│       │   ├── Certificates.jsx    ← List all certs + detail lookup
│       │   ├── VerifyCert.jsx      ← Upload + verify a PEM file
│       │   ├── RevokeCert.jsx      ← Revoke by serial + reason
│       │   ├── AuditLog.jsx        ← Hash-chain audit log viewer
│       │   ├── CRL.jsx             ← CRL rebuild + revoked list
│       │   ├── IntermediateCA.jsx  ← Issue via Intermediate CA
│       │   ├── PolicyManager.jsx   ← Per-template policy rules
│       │   ├── RequestPortal.jsx   ← Self-service request form + admin approval queue
│       │   ├── EmployeeView.jsx    ← Simplified employee-facing portal
│       │   ├── Templates.jsx       ← Certificate template reference
│       │   ├── ACME.jsx            ← ACME order + renewal check
│       │   ├── OCSP.jsx            ← Real-time certificate status check
│       │   └── Guide.jsx           ← Plain-English guide for non-technical users
│       ├── api.js              ← Axios wrapper for all API calls
│       ├── App.jsx             ← Role-based routing: landing → employee / admin
│       ├── index.css           ← Dark purple/cyan theme
│       └── main.jsx            ← React entry point
│
└── storage/                    ← Runtime-generated data (gitignored)
    ├── certs/                  ← Issued certificate PEM files
    ├── csr/                    ← CSR + private key PEM files
    ├── crl/                    ← CRL PEM + revocation registry JSON
    ├── audit/                  ← Audit log JSON + system log
    ├── ca_certificate.pem      ← Root CA certificate
    ├── ca_private_key.pem      ← Root CA private key (encrypted)
    ├── intermediate_certificate.pem
    ├── intermediate_private_key.pem
    └── ca_database.db          ← SQLite database
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
|---|---|---|
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
| GET | `/api/dashboard/stats` | Certificate counts + CA health |
| GET | `/api/dashboard/expiring` | Certificates expiring within N days |
| GET | `/api/dashboard/renewals` | Recent auto-renewal log |
| GET | `/api/policy/` | List all policies |
| POST | `/api/policy/` | Create or update a policy |
| DELETE | `/api/policy/{template}` | Delete a policy |
| POST | `/api/policy/trigger/{job_id}` | Manually trigger scheduler job |
| POST | `/api/requests/` | Submit a certificate request |
| GET | `/api/requests/` | List all requests (admin) |
| POST | `/api/requests/{id}/approve` | Approve a request → cert auto-issued |
| POST | `/api/requests/{id}/reject` | Reject a request with reason |
| POST | `/ocsp` | OCSP responder — DER format (RFC 6960) |
| GET | `/ocsp/status/{serial}` | OCSP status as JSON (debug) |
| POST | `/acme/order` | Create ACME certificate order |
| GET | `/acme/challenge/{token}` | Serve ACME http-01 challenge |
| POST | `/acme/challenge/{token}/validate` | Validate ACME challenge |
| POST | `/acme/finalize/{order_id}` | Submit CSR and receive certificate |
| GET | `/acme/renewals/due` | List certificates expiring soon |

---

## Environment Variables (Optional)

| Variable | Default | Description |
|---|---|---|
| `OCSP_URL` | `http://localhost:8000/ocsp` | OCSP URL embedded in issued certificates |
| `LDAP_ENABLED` | `false` | Enable LDAP identity verification |
| `LDAP_SERVER` | `ldap://localhost:389` | LDAP server URL |
| `LDAP_BASE_DN` | `dc=example,dc=com` | LDAP base DN |
| `LDAP_BIND_DN` | `cn=admin,dc=example,dc=com` | LDAP bind DN |
| `LDAP_BIND_PASS` | _(empty)_ | LDAP bind password |
| `LDAP_USER_ATTR` | `uid` | LDAP user attribute (`uid` or `mail` for AD) |
