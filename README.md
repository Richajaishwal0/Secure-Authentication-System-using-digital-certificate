# Digital Certificate Authority (CA)

A fully functional **Public Key Infrastructure (PKI)** system built in Python. This project works exactly like a real Certificate Authority — the same technology behind every HTTPS website, corporate login, signed email, and software update.

---

## What This Project Does

Think of it as a **digital ID card factory**. It creates, verifies, and cancels digital certificates that prove identity — the same way DigiCert or Let's Encrypt works.

| Feature | What It Does | Real World Equivalent |
|---|---|---|
| Root CA | Creates the master key that signs everything | DigiCert / Let's Encrypt root |
| Intermediate CA | A sub-authority signed by Root — used daily so Root stays safe | Let's Encrypt R3 intermediate |
| Issue Certificate | Signs a digital ID card binding a name to a public key | Buying an SSL cert for your website |
| Certificate Templates | Different cert types for different purposes | TLS cert vs email cert vs code signing cert |
| Verify Certificate | Checks signature, expiry, and revocation status | Browser checking the HTTPS padlock |
| Revoke Certificate | Cancels a certificate instantly | Blocking a stolen credit card |
| CRL | Signed blacklist of all cancelled certificates | Browser's certificate blacklist |
| OCSP | Real-time "is this cert valid?" check | Browser's live cert status check |
| Audit Log | Tamper-proof record of every CA action | Bank transaction records |
| ACME Protocol | Automated certificate renewal — no human needed | How Let's Encrypt auto-renews certs |
| REST API | Full HTTP API for all CA operations | Enterprise CA web service |
| Database | All certificates stored in SQLite / PostgreSQL | Production CA certificate store |
| LDAP Integration | Verify user identity from Active Directory before issuing | Enterprise CA identity check |

---

## Cryptography & Security Algorithms

| Algorithm | Standard | Used For | Where in Code |
|---|---|---|---|
| RSA-2048 | NIST SP 800-57 | Key pair generation for CA, Intermediate CA, and all certificate requesters | `utils/crypto_utils.py` |
| SHA-256 | FIPS 180-4 | Signing certificates, signing CRLs, signing CSRs | All `.sign(key, hashes.SHA256())` calls |
| PKCS#1 v1.5 | RFC 3447 | RSA signature padding for certificate verification | `ca/cert_verifier.py` |
| X.509 v3 | RFC 5280 | Structure and format of all certificates | `ca/ca_setup.py`, `ca/cert_issuer.py` |
| PKCS#10 | RFC 2986 | Certificate Signing Request format — requester proves key ownership | `ca/csr_generator.py` |
| AES-256-CBC + PBKDF2 | FIPS 197 | Encrypting all private keys before saving to disk — never stored in plaintext | `utils/crypto_utils.py` |
| SHA-256 Hash Chain | — | Tamper-evident audit log — each entry hashes the previous one, like blockchain | `audit/audit_log.py` |
| X.509 CRL | RFC 5280 §5 | Signed revocation list published by the CA | `ca/crl_manager.py` |
| OCSP | RFC 6960 | Real-time certificate status protocol — returns GOOD or REVOKED | `api/routes/ocsp.py` |
| ACME | RFC 8555 | Automated certificate issuance and renewal protocol | `api/routes/acme.py` |

### Why These Algorithms

- **RSA-2048** — NIST minimum recommendation. Public exponent 65537 (Fermat prime) is standard and efficient.
- **SHA-256** — SHA-1 was deprecated for certificates in 2017. SHA-256 is collision-resistant and universally accepted.
- **AES-256** — Private keys are never written to disk in plaintext. AES-256-CBC with PBKDF2 key derivation is used automatically via `BestAvailableEncryption`.
- **Hash-chained audit log** — Any modification to a past entry changes its hash, which breaks the `prev_hash` link of every entry after it. Detected instantly by `verify_chain()`.
- **PKCS#10 CSR verification** — Before signing any certificate, the CA verifies the CSR's self-signature. This proves the requester actually owns the private key and prevents identity theft attacks.

---

## Certificate Templates

Each template sets the correct X.509 v3 extensions for its use case:

| Template | Purpose | Key Usage | Extended Key Usage |
|---|---|---|---|
| `client_auth` | Employee login, user identity | Digital Signature, Key Encipherment | clientAuth, emailProtection |
| `tls_server` | HTTPS website certificate | Digital Signature, Key Encipherment | serverAuth, clientAuth |
| `email_signing` | S/MIME signed and encrypted email | Digital Signature, Data Encipherment | emailProtection |
| `code_signing` | Software / firmware signing | Digital Signature, Content Commitment | codeSigning |

---

## Project Structure

```
digital_ca/
├── gui.py                        # Desktop GUI (tkinter) — 9 tabs
├── main.py                       # CLI entry point
├── cli.py                        # CLI commands (init, issue, verify, revoke, audit, crl)
├── config.py                     # All configuration — paths, CA subject, key settings
├── logger.py                     # Rotating file + console logger
├── requirements.txt
│
├── ca/
│   ├── ca_setup.py               # Root CA — RSA key generation + self-signed X.509 cert
│   ├── intermediate_ca.py        # Intermediate CA — signed by Root, issues end-entity certs
│   ├── cert_templates.py         # Certificate profiles (tls_server, email_signing, etc.)
│   ├── csr_generator.py          # PKCS#10 CSR creation
│   ├── cert_issuer.py            # Signs CSRs → issues X.509 v3 certificates
│   ├── cert_verifier.py          # Verifies signature, expiry, revocation
│   └── crl_manager.py            # Certificate Revocation List management
│
├── api/
│   ├── main.py                   # FastAPI application — 20 REST endpoints
│   └── routes/
│       ├── certs.py              # POST /issue, GET /, GET /{serial}, POST /verify, POST /revoke
│       ├── crl.py                # GET /crl, POST /crl/rebuild
│       ├── audit.py              # GET /audit, GET /audit/verify
│       ├── ocsp.py               # POST /ocsp (RFC 6960), GET /ocsp/status/{serial}
│       └── acme.py               # POST /order, challenge, validate, finalize, renewals/due
│
├── db/
│   ├── models.py                 # SQLAlchemy ORM — certificates, revoked_certs, audit_entries, acme_challenges
│   └── database.py               # SQLite (default) or PostgreSQL via DATABASE_URL env var
│
├── audit/
│   └── audit_log.py              # SHA-256 hash-chained append-only audit log
│
├── integrations/
│   └── ldap_client.py            # LDAP / Active Directory identity lookup
│
├── utils/
│   └── crypto_utils.py           # Key generation, serialization, file I/O helpers
│
├── storage/
│   ├── ca_private_key.pem        # Root CA private key (AES-256 encrypted)
│   ├── ca_certificate.pem        # Root CA certificate (public)
│   ├── intermediate_private_key.pem   # Intermediate CA private key (AES-256 encrypted)
│   ├── intermediate_certificate.pem   # Intermediate CA certificate (public)
│   ├── ca_database.db            # SQLite database
│   ├── certs/                    # Issued end-entity certificates
│   ├── csr/                      # CSRs + requester private keys
│   ├── crl/                      # CRL PEM + revoked serial registry
│   └── audit/                    # audit_log.json + ca_system.log
│
└── tests/
    └── test_ca.py                # 33 unit tests
```

---

## How to Run

### Step 0 — Install dependencies
```bash
cd C:\Users\richa\OneDrive\CYS\digital_ca
pip install -r requirements.txt
```

---

### Option 1 — GUI (Desktop App)
```bash
python gui.py
```
Opens a dark-themed window with 9 tabs. Everything is clickable — no commands needed.

| Tab | What You Do |
|---|---|
| Init CA | Click "Initialize CA" — creates Root CA |
| Issue Cert | Fill name + email, pick template, click "Issue Certificate" |
| Verify | Browse to a `.pem` file, click "Verify Certificate" |
| Revoke | Paste serial number, pick reason, click "Revoke Certificate" |
| Audit Log | Click "Load Audit Log" — shows all events + chain integrity |
| CRL | Click "Load / Rebuild CRL" — shows all revoked serials |
| Intermediate CA | Click "Init Intermediate CA", then "Issue via Intermediate" |
| Templates | Shows all 4 template profiles and their extensions |
| ACME Renewal | Simulate ACME order + check certs expiring soon (needs API running) |

---

### Option 2 — REST API
```bash
uvicorn api.main:app --reload --port 8000
```
Then open **http://localhost:8000/docs** — full Swagger UI, every endpoint is clickable.

Key endpoints:

```
POST   /api/certs/issue          Issue a certificate
GET    /api/certs/               List all certificates
GET    /api/certs/{serial}       Get certificate by serial
POST   /api/certs/verify         Upload .pem and verify it
POST   /api/certs/revoke         Revoke by serial
GET    /api/crl                  Download the CRL
GET    /api/audit                View audit log
POST   /ocsp                     OCSP real-time status check
POST   /acme/order               Start ACME certificate order
GET    /acme/renewals/due        List certs expiring in 30 days
```

Example — issue a TLS server certificate:
```bash
curl -X POST http://localhost:8000/api/certs/issue \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Alice\",\"email\":\"alice@example.com\",\"template\":\"tls_server\",\"san_names\":[\"example.com\"]}"
```

Switch to PostgreSQL (optional):
```bash
set DATABASE_URL=postgresql://user:pass@localhost:5432/digital_ca
uvicorn api.main:app --reload --port 8000
```

---

### Option 3 — CLI
```bash
python main.py init
python main.py issue --name "Alice" --email alice@example.com
python main.py verify --cert storage\certs\alice_<serial>.pem
python main.py revoke --serial <serial> --reason key_compromise
python main.py audit
python main.py crl
```

All revocation reasons: `unspecified | key_compromise | ca_compromise | affiliation_changed | superseded | cessation_of_operation | privilege_withdrawn`

---

### Option 4 — Tests
```bash
python -m pytest tests/test_ca.py -v
```

---

## How This Project Differs From Existing Systems

This is an honest, code-backed comparison. Not every feature here is unique in the world — but the **combination** of all of them in a single lightweight Python project does not exist anywhere else.

---

### 1. Hash-Chained Audit Log — Built Into the CA Itself

**What existing tools do:**
- OpenSSL CA — no audit log at all
- EJBCA — logs to a database, but the log is mutable (a DBA can edit it)
- HashiCorp Vault — logs to syslog/file, no cryptographic integrity guarantee
- Microsoft ADCS — logs to Windows Event Log, editable by administrators

**What this project does (`audit/audit_log.py`):**
```
Entry 0: event=CA_INITIALIZED  prev_hash=0000...  hash=a3f9...
Entry 1: event=CERT_ISSUED      prev_hash=a3f9...  hash=b72c...
Entry 2: event=CERT_REVOKED     prev_hash=b72c...  hash=d41e...
```
Every entry contains the SHA-256 hash of the previous entry. If anyone edits entry 1, its hash changes — which breaks entry 2's `prev_hash` link — which breaks every entry after it. `verify_chain()` detects this instantly. This is the same principle as blockchain, applied directly to CA audit logging. No existing lightweight CA tool does this.

---

### 2. Dual Revocation System — CRL + OCSP Together

**What existing tools do:**
- OpenSSL CA — CRL only, manual rebuild required after every revocation
- Most lightweight CA tools — CRL only, no OCSP

**What this project does:**
- `ca/crl_manager.py` — CRL is **automatically rebuilt** every time a certificate is revoked. No manual step.
- `api/routes/ocsp.py` — A live RFC 6960 OCSP responder runs alongside the CA. Clients get real-time GOOD/REVOKED responses without downloading the full CRL.
- Both systems share the same revocation registry — one revoke call updates both.

---

### 3. Certificate Templates With Correct X.509 Extensions Per Use Case

**What existing tools do:**
- OpenSSL — you manually write extensions in `openssl.cnf`. Easy to get wrong.
- Most Python CA examples online — issue every cert with the same extensions regardless of purpose.

**What this project does (`ca/cert_templates.py`):**
Each template enforces the correct `KeyUsage` and `ExtendedKeyUsage` combination:

| Template | Key Usage set correctly | Extended Key Usage |
|---|---|---|
| `tls_server` | digitalSignature + keyEncipherment | serverAuth + clientAuth |
| `email_signing` | digitalSignature + dataEncipherment | emailProtection |
| `code_signing` | digitalSignature + contentCommitment only | codeSigning |
| `client_auth` | digitalSignature + keyEncipherment | clientAuth + emailProtection |

A TLS server cert issued with wrong KeyUsage will be rejected by browsers. This project prevents that by design.

---

### 4. Two-Layer CA Hierarchy With path_length Enforcement

**What existing tools do:**
- OpenSSL — you can set up an intermediate CA but it requires multiple config files, manual steps, and it's easy to misconfigure `path_length`.
- Most lightweight CA tools — root CA only, no intermediate.

**What this project does (`ca/intermediate_ca.py`):**
- Intermediate CA cert is issued with `BasicConstraints(ca=True, path_length=0)` — enforced in code, not config.
- `path_length=0` means the intermediate can only sign end-entity certs, not other CAs — exactly how Let's Encrypt's R3 intermediate works.
- Root CA key is only used to sign the intermediate. Day-to-day issuance uses the intermediate key.
- If the intermediate is compromised, revoke it and generate a new one. Root trust anchor is untouched.

---

### 5. ACME Protocol With Expiry Tracking

**What existing tools do:**
- Let's Encrypt — full ACME, but it's a cloud service, not something you run yourself.
- certbot — ACME client only, not a CA.
- No lightweight self-hosted CA implements ACME.

**What this project does (`api/routes/acme.py`):**
- Full order → challenge → validate → finalize flow (RFC 8555 simplified).
- `GET /acme/renewals/due` queries the database for certificates expiring within N days — clients can poll this to trigger auto-renewal.
- ACME-issued certs automatically use the `tls_server` template with correct SAN extensions.
- Challenge tokens expire after 10 minutes — same security model as real ACME.

---

### 6. Three Interfaces Sharing One Backend

**What existing tools do:**
- OpenSSL — CLI only
- EJBCA — Web GUI only
- certbot — CLI only
- Vault PKI — REST API only

**What this project does:**
- GUI (`gui.py`), REST API (`api/main.py`), and CLI (`cli.py`) all use the exact same CA modules.
- A cert issued via CLI appears in the GUI and is queryable via the API — same storage, same audit log.
- The REST API has 20 endpoints with auto-generated Swagger docs at `/docs`.

---

### 7. Database Backend Switchable With One Environment Variable

**What existing tools do:**
- OpenSSL — flat files only
- EJBCA — requires PostgreSQL/MySQL setup before it even starts
- Vault — requires its own storage backend

**What this project does (`db/database.py`):**
- SQLite by default — zero setup, works immediately.
- Switch to PostgreSQL by setting one environment variable:
  ```
  set DATABASE_URL=postgresql://user:pass@localhost:5432/digital_ca
  ```
- Same code, same models, same queries — SQLAlchemy handles the difference.

---

### 8. CSR Signature Verified Before Issuance

**What existing tools do:**
- Many CA implementations skip this check or leave it to the library.

**What this project does (`ca/cert_issuer.py` and `ca/intermediate_ca.py`):**
```python
if not csr.is_signature_valid:
    raise ValueError("CSR signature is invalid — request rejected.")
```
This prevents a specific attack: an attacker submits a CSR containing someone else's public key. Without this check, the CA would sign a certificate binding the victim's public key to the attacker's identity. This check is present in both the root CA issuer and the intermediate CA issuer.

---

### Summary Table

| Feature | OpenSSL | EJBCA | Vault PKI | Let's Encrypt | This Project |
|---|---|---|---|---|---|
| Hash-chained audit log | ❌ | ❌ | ❌ | ❌ | ✅ |
| Auto CRL rebuild on revoke | ❌ manual | ✅ | ✅ | ✅ | ✅ |
| OCSP responder built-in | ❌ separate | ✅ | ✅ | ✅ | ✅ |
| Certificate templates | ❌ manual config | ✅ | ⚠️ partial | ⚠️ TLS only | ✅ 4 templates |
| Intermediate CA hierarchy | ⚠️ complex setup | ✅ | ✅ | ✅ | ✅ |
| ACME protocol | ❌ | ❌ | ⚠️ partial | ✅ cloud only | ✅ self-hosted |
| GUI + API + CLI together | ❌ | ⚠️ GUI only | ⚠️ API only | ❌ | ✅ |
| Zero infrastructure setup | ✅ | ❌ needs JBoss+DB | ❌ needs Vault server | ❌ cloud service | ✅ |
| SQLite → PostgreSQL switchable | ❌ | ❌ | ❌ | ❌ | ✅ |
| Full source under 1000 lines | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Security Design Decisions

| Decision | Reason |
|---|---|
| RSA-2048 with e=65537 | NIST minimum; Fermat prime exponent is efficient and secure |
| SHA-256 for all signatures | SHA-1 deprecated since 2017; SHA-256 is collision-resistant |
| AES-256 + PBKDF2 for private keys | Keys never stored in plaintext on disk |
| File permissions `0o600` for private keys | Owner read/write only — other OS users cannot read keys |
| CSR signature verified before issuance | Prevents submitting a CSR with someone else's public key |
| `BasicConstraints(ca=False)` on end-entity certs | Prevents issued certs from signing other certificates |
| `path_length=0` on Intermediate CA cert | Intermediate can only sign end-entity certs, not other CAs |
| Hash-chained audit log | Modification of any past entry breaks all subsequent hashes |
| Serial numbers as CRL keys | Matches RFC 5280 standard; serials are unique per CA |
| OCSP over CRL for real-time checks | CRL requires downloading the full list; OCSP is a single query |
