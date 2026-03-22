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
- Exports certificates as password-protected PKCS#12 (.p12) bundles for direct import into Windows/macOS certificate stores, browsers, VPN clients, and email clients

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
- Real-time notifications via Firebase Firestore when requests are approved or rejected

### 5. Two Distinct User Interfaces
- **Employee Portal** — simplified 3-screen view: request a certificate, view my certificates, check a certificate
- **Admin Panel** — full management: dashboard, issue, verify, revoke, CRL, audit log, policy manager, request queue

### 6. Real-Time Certificate Status (OCSP)
- Implements an RFC 6960 OCSP responder
- Any browser or TLS client can query the endpoint to check if a certificate is valid or revoked in real time
- Returns DER-encoded signed OCSP responses

### 7. ACME Protocol for Internal Servers
- Implements a simplified RFC 8555 ACME flow (order → challenge → validate → finalize)
- Internal servers can automatically request and renew TLS certificates without manual admin involvement
- Challenge validation is auto-approved in this prototype — in production it would fetch the domain to verify
- Same protocol used by Let's Encrypt — adapted for internal/private CA use

### 8. Tamper-Evident Audit Log
- Every CA operation (issue, revoke, verify, renew) is recorded in a hash-chained log
- Each entry contains a SHA-256 hash of the previous entry — any modification breaks the chain
- Chain integrity can be verified at any time from the admin panel
- Audit log can be cleared by the admin when needed

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

## How It Works

### Client: Requesting a Certificate

Employees interact through a simplified portal — no PKI knowledge needed.

**Step 1 — Open the Employee Portal**
Navigate to the app and select "I'm an Employee". You land on a 3-screen view: Request, My Certificates, Check a Certificate.

<!-- screenshot: employee portal landing -->

**Step 2 — Submit a Request**
Fill in your name, email, and choose what you need in plain English (VPN Access, Email Signing, Web Server, Code Signing). Optionally add a hostname/SAN if needed. Hit Submit.

<!-- screenshot: request form -->

**Step 3 — Wait for Approval (or get auto-approved)**
Low-risk templates like `client_auth` are auto-approved by policy — your certificate is issued immediately. Higher-risk templates like `code_signing` go into the admin queue.

<!-- screenshot: request submitted / pending status -->

**Step 4 — Download Your Certificate**
Once approved, the certificate appears under "My Certificates". You can view details, download the PEM file, or download a password-protected .p12 bundle ready to import into your system.

<!-- screenshot: my certificates view -->

**Step 5 — Check / Verify a Certificate**
Upload any PEM file to the "Check a Certificate" screen. The system checks signature validity, expiry, and revocation status and shows a clear valid / revoked / expired result.

<!-- screenshot: verify certificate result -->

---

### Admin: Managing the CA

Admins get a full-featured panel covering every aspect of the CA lifecycle.

**Dashboard**
See live counts of total, active, revoked, expired, and expiring-soon certificates. CA health shows days until root CA expiry. Manually trigger the expiry check or auto-renew job from here.

<!-- screenshot: admin dashboard -->

**Approving / Rejecting Requests**
The Request Queue lists all pending employee requests. Admin can approve (certificate is issued instantly) or reject with a reason. The requester's status updates immediately via Firebase notification.

<!-- screenshot: request queue with approve/reject -->

**Issuing Certificates Directly**
Admins can issue certificates directly — choose a template, fill in subject details, add SANs, set validity, and toggle auto-renew. The signed PEM is stored and available immediately.

<!-- screenshot: issue certificate form -->

**Revoking a Certificate**
Enter the serial number and select a reason code (key compromise, affiliation changed, superseded, etc.). The certificate is added to the CRL and its OCSP status flips to revoked instantly.

<!-- screenshot: revoke certificate -->

**Policy Manager**
Per-template rules control max validity, auto-renewal window (days before expiry to renew), expiry warning window, and whether admin approval is required. Changes take effect on the next issuance or renewal cycle.

<!-- screenshot: policy manager -->

**CRL Management**
View the current Certificate Revocation List and force-rebuild it at any time. The CRL is signed by the CA and can be downloaded as PEM.

<!-- screenshot: CRL page -->

**Audit Log**
Every CA operation is recorded in a hash-chained log. The chain integrity status is shown at the top — green means untampered. Each entry shows timestamp, action, subject, serial, and the SHA-256 chain hash. The log can be cleared by the admin.

<!-- screenshot: audit log with chain integrity -->

**Intermediate CA**
Issue end-entity certificates via the Intermediate CA instead of the Root CA directly — following the two-tier PKI hierarchy best practice.

<!-- screenshot: intermediate CA page -->

**OCSP & ACME**
The OCSP page lets you query real-time revocation status for any serial. The ACME page shows active orders and lets internal servers automate certificate renewal using the same protocol as Let's Encrypt.

<!-- screenshot: OCSP status check -->
<!-- screenshot: ACME orders -->

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
| Importing certificates into Windows/macOS/browsers | PKCS#12 (.p12) export with password protection, ready to double-click and import |

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
| Frontend | React 18, Vite, Axios, Lucide React |
| Auth & Notifications | Firebase (Authentication + Firestore) |
| Backend | Python, FastAPI, Uvicorn |
| Cryptography | Python `cryptography` library — RSA-2048, X.509 v3, SHA-256, PKCS#12 |
| Database | SQLite (default) / PostgreSQL (optional) |
| ORM | SQLAlchemy |
| Scheduler | APScheduler |
| Email Delivery | SendGrid REST API |
| Testing | pytest, httpx |

---

## Running the Project

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # fill in your values
uvicorn api.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # fill in your Firebase config
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
| GET | `/api/certs/{serial}/download/p12` | Download certificate as PKCS#12 (.p12) bundle |
| POST | `/api/certs/verify` | Verify a PEM certificate (file upload) |
| POST | `/api/certs/revoke` | Revoke a certificate |
| POST | `/api/certs/send` | Log certificate delivery + send via SendGrid |
| DELETE | `/api/certs/{serial}` | Delete a certificate record |
| GET | `/api/crl` | Get current CRL as PEM |
| POST | `/api/crl/rebuild` | Force-rebuild the CRL |
| GET | `/api/audit` | Get full audit log + chain integrity |
| GET | `/api/audit/verify` | Verify audit chain integrity only |
| DELETE | `/api/audit/clear` | Clear the audit log |
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
| GET | `/api/settings/smtp` | Get current email config |
| POST | `/api/settings/smtp` | Save email config |
| POST | `/api/settings/smtp/test` | Send a test email |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `CA_COUNTRY` | `IN` | Country code embedded in Root CA certificate |
| `CA_STATE`, `CA_LOCALITY`, `CA_ORG`, `CA_ORG_UNIT`, `CA_COMMON_NAME`, `CA_EMAIL` | _(see .env.example)_ | Root CA identity fields |
| `CA_KEY_PASSWORD` | `change-this-in-production` | Encryption password for Root CA private key |
| `INT_KEY_PASSWORD` | `intermediate-key-password` | Encryption password for Intermediate CA private key |
| `OCSP_URL` | `http://localhost:8000/ocsp` | OCSP URL embedded in issued certificates |
| `CRL_URL` | `http://localhost:8000/api/crl` | CRL distribution point URL embedded in issued certificates |
| `SENDGRID_ENABLED` | `false` | Enable certificate delivery emails via SendGrid |
| `SENDGRID_API_KEY` | _(empty)_ | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | _(empty)_ | Sender address for certificate emails |
| `LDAP_ENABLED` | `false` | Enable LDAP identity verification |
| `LDAP_SERVER` | `ldap://localhost:389` | LDAP server URL |
| `LDAP_BASE_DN` | `dc=example,dc=com` | LDAP base DN |
| `LDAP_BIND_DN` | `cn=admin,dc=example,dc=com` | LDAP bind DN |
| `LDAP_BIND_PASS` | _(empty)_ | LDAP bind password |
| `LDAP_USER_ATTR` | `uid` | LDAP user attribute (`uid` or `mail` for AD) |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_ADMIN_EMAIL` | Admin email for Firebase role check |

---

## Security Notes

- CA private keys are AES-encrypted on disk using the password from `.env`
- The `storage/` directory is gitignored — keys and certificates never leave your machine
- Never commit `.env` files — use the provided `.env.example` templates as a starting point
- The audit log is hash-chained — integrity is verified and displayed live in the admin panel
- Revoked certificates are reflected instantly in both the CRL and OCSP responder
