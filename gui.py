"""
gui.py — Digital Certificate Authority GUI
Run with: python gui.py
"""

import tkinter as tk
from tkinter import ttk, filedialog, scrolledtext, messagebox
import threading
import os
import sys
import io
from datetime import datetime

# ── Colour palette ─────────────────────────────────────────────────────────────
BG          = "#1e1e2e"   # dark background
PANEL       = "#2a2a3e"   # card/panel background
ACCENT      = "#7c3aed"   # purple accent
ACCENT2     = "#06b6d4"   # cyan accent
SUCCESS     = "#22c55e"   # green
DANGER      = "#ef4444"   # red
WARNING     = "#f59e0b"   # amber
TEXT        = "#e2e8f0"   # primary text
TEXT_DIM    = "#94a3b8"   # secondary text
BORDER      = "#3f3f5a"   # border colour
BTN_FG      = "#ffffff"


# ── Redirect stdout/stderr into the GUI log panel ──────────────────────────────
class _LogRedirect(io.TextIOBase):
    def __init__(self, widget: scrolledtext.ScrolledText):
        self._w = widget

    def write(self, msg: str) -> int:
        if msg.strip():
            self._w.configure(state="normal")
            ts = datetime.now().strftime("%H:%M:%S")
            self._w.insert(tk.END, f"[{ts}]  {msg}\n")
            self._w.see(tk.END)
            self._w.configure(state="disabled")
        return len(msg)

    def flush(self): pass


# ── Reusable widget helpers ────────────────────────────────────────────────────
def _label(parent, text, size=10, bold=False, color=TEXT, **kw):
    font = ("Segoe UI", size, "bold" if bold else "normal")
    return tk.Label(parent, text=text, font=font, fg=color, bg=PANEL, **kw)


def _entry(parent, width=38, show=None):
    e = tk.Entry(parent, width=width, show=show,
                 bg="#12121f", fg=TEXT, insertbackground=TEXT,
                 relief="flat", font=("Segoe UI", 10),
                 highlightthickness=1, highlightbackground=BORDER,
                 highlightcolor=ACCENT)
    return e


def _btn(parent, text, command, color=ACCENT, width=18):
    return tk.Button(parent, text=text, command=command,
                     bg=color, fg=BTN_FG, activebackground=color,
                     font=("Segoe UI", 10, "bold"),
                     relief="flat", cursor="hand2",
                     padx=12, pady=6, width=width)


def _section(parent, title):
    """Titled card frame."""
    outer = tk.Frame(parent, bg=PANEL, bd=0,
                     highlightthickness=1, highlightbackground=BORDER)
    tk.Label(outer, text=f"  {title}  ", font=("Segoe UI", 10, "bold"),
             fg=ACCENT2, bg=PANEL).pack(anchor="w", padx=10, pady=(8, 2))
    tk.Frame(outer, bg=BORDER, height=1).pack(fill="x", padx=10)
    inner = tk.Frame(outer, bg=PANEL)
    inner.pack(fill="both", expand=True, padx=14, pady=10)
    return outer, inner


def _result_box(parent, height=6):
    box = scrolledtext.ScrolledText(parent, height=height,
                                    bg="#0d0d1a", fg=TEXT,
                                    font=("Consolas", 9),
                                    relief="flat", state="disabled",
                                    wrap="word",
                                    highlightthickness=1,
                                    highlightbackground=BORDER)
    return box


def _show(box, text, color=TEXT):
    box.configure(state="normal")
    box.delete("1.0", tk.END)
    box.insert(tk.END, text)
    box.configure(state="disabled", fg=color)


# ── Main Application ───────────────────────────────────────────────────────────
class CAApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Digital Certificate Authority")
        self.geometry("1000x720")
        self.configure(bg=BG)
        self.resizable(True, True)

        self._build_header()
        self._build_notebook()
        self._build_log_panel()
        self._redirect_output()

    # ── Header ─────────────────────────────────────────────────────────────────
    def _build_header(self):
        hdr = tk.Frame(self, bg=ACCENT, height=52)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        tk.Label(hdr, text="  Digital Certificate Authority",
                 font=("Segoe UI", 14, "bold"),
                 fg=BTN_FG, bg=ACCENT).pack(side="left", padx=16)
        tk.Label(hdr, text="PKI v2  |  RSA-2048  |  X.509 v3  |  OCSP  |  ACME  |  Intermediate CA  |  Templates",
                 font=("Segoe UI", 9), fg="#ddd6fe", bg=ACCENT).pack(side="right", padx=16)

    # ── Notebook tabs ──────────────────────────────────────────────────────────
    def _build_notebook(self):
        style = ttk.Style(self)
        style.theme_use("default")
        style.configure("TNotebook",        background=BG, borderwidth=0)
        style.configure("TNotebook.Tab",    background=PANEL, foreground=TEXT_DIM,
                        font=("Segoe UI", 10, "bold"), padding=[16, 8])
        style.map("TNotebook.Tab",
                  background=[("selected", ACCENT)],
                  foreground=[("selected", BTN_FG)])

        self.nb = ttk.Notebook(self)
        self.nb.pack(fill="both", expand=True, padx=10, pady=(8, 0))

        tabs = [
            ("  Init CA  ",        self._tab_init),
            ("  Issue Cert  ",     self._tab_issue),
            ("  Verify  ",         self._tab_verify),
            ("  Revoke  ",         self._tab_revoke),
            ("  Audit Log  ",      self._tab_audit),
            ("  CRL  ",            self._tab_crl),
            ("  Intermediate CA ", self._tab_intermediate),
            ("  Templates  ",      self._tab_templates),
            ("  ACME Renewal  ",   self._tab_acme),
        ]
        for title, builder in tabs:
            frame = tk.Frame(self.nb, bg=BG)
            self.nb.add(frame, text=title)
            builder(frame)

    # ── Live log panel at bottom ───────────────────────────────────────────────
    def _build_log_panel(self):
        bar = tk.Frame(self, bg=PANEL, height=28)
        bar.pack(fill="x", padx=10)
        bar.pack_propagate(False)
        tk.Label(bar, text="  System Log", font=("Segoe UI", 9, "bold"),
                 fg=ACCENT2, bg=PANEL).pack(side="left")
        _btn(bar, "Clear", self._clear_log, color="#374151", width=6).pack(side="right", padx=6, pady=2)

        self.log_box = scrolledtext.ScrolledText(
            self, height=7, bg="#0a0a14", fg="#86efac",
            font=("Consolas", 8), relief="flat", state="disabled",
            highlightthickness=1, highlightbackground=BORDER)
        self.log_box.pack(fill="x", padx=10, pady=(0, 8))

    def _clear_log(self):
        self.log_box.configure(state="normal")
        self.log_box.delete("1.0", tk.END)
        self.log_box.configure(state="disabled")

    def _redirect_output(self):
        redir = _LogRedirect(self.log_box)
        sys.stdout = redir
        sys.stderr = redir

    # ── Run CA operations in background thread (keeps UI responsive) ───────────
    def _run(self, fn):
        threading.Thread(target=fn, daemon=True).start()

    # ══════════════════════════════════════════════════════════════════════════
    # TAB 1 — Init CA
    # ══════════════════════════════════════════════════════════════════════════
    def _tab_init(self, parent):
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="both", expand=True, padx=20, pady=16)

        card, inner = _section(wrap, "Root Certificate Authority")
        card.pack(fill="x")

        _label(inner,
               "Initialize the Root CA — generates an RSA-2048 key pair and a\n"
               "self-signed X.509 v3 certificate. Safe to run multiple times\n"
               "(loads existing CA if already initialized).",
               color=TEXT_DIM).pack(anchor="w", pady=(0, 12))

        self._init_result = _result_box(inner, height=10)
        self._init_result.pack(fill="x")

        btn_row = tk.Frame(inner, bg=PANEL)
        btn_row.pack(fill="x", pady=(10, 0))
        _btn(btn_row, "Initialize CA", self._do_init, color=ACCENT).pack(side="left")

        # Status badge
        self._init_status = tk.Label(btn_row, text="", font=("Segoe UI", 10, "bold"),
                                     fg=TEXT_DIM, bg=PANEL)
        self._init_status.pack(side="left", padx=14)

    def _do_init(self):
        def task():
            try:
                from ca.ca_setup import CertificateAuthority
                ca = CertificateAuthority()
                _, cert = ca.initialize()
                lines = [
                    "=" * 52,
                    "  ROOT CA READY",
                    "=" * 52,
                    f"  Subject     : {cert.subject.rfc4514_string()}",
                    f"  Issuer      : {cert.issuer.rfc4514_string()}",
                    f"  Serial      : {cert.serial_number}",
                    f"  Valid From  : {cert.not_valid_before_utc}",
                    f"  Valid Until : {cert.not_valid_after_utc}",
                    f"  Key Size    : 2048 bits (RSA)",
                    f"  Signature   : SHA-256",
                    "=" * 52,
                    "",
                    "  [OK] CA is ready to issue certificates.",
                ]
                _show(self._init_result, "\n".join(lines), SUCCESS)
                self._init_status.config(text="CA READY", fg=SUCCESS)
            except Exception as e:
                _show(self._init_result, f"[ERROR] {e}", DANGER)
                self._init_status.config(text="FAILED", fg=DANGER)
        self._run(task)

    # ══════════════════════════════════════════════════════════════════════════
    # TAB 2 — Issue Certificate
    # ══════════════════════════════════════════════════════════════════════════
    def _tab_issue(self, parent):
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="both", expand=True, padx=20, pady=16)

        card, inner = _section(wrap, "Issue Certificate")
        card.pack(fill="x")

        # Form grid
        fields = [
            ("Full Name *",    "name"),
            ("Email *",        "email"),
            ("Organization",   "org"),
            ("Org Unit",       "org_unit"),
            ("Country (2-letter)", "country"),
            ("State",          "state"),
            ("City",           "locality"),
            ("Validity (days)", "days"),
        ]
        self._issue_vars = {}
        defaults = {
            "org": "Example Corp", "org_unit": "Engineering",
            "country": "US", "state": "California",
            "locality": "San Francisco", "days": "365",
        }

        grid = tk.Frame(inner, bg=PANEL)
        grid.pack(fill="x")

        for i, (label, key) in enumerate(fields):
            row, col = divmod(i, 2)
            tk.Label(grid, text=label, font=("Segoe UI", 9),
                     fg=TEXT_DIM, bg=PANEL).grid(row=row*2, column=col*2,
                                                  sticky="w", padx=(0, 20), pady=(6, 0))
            e = _entry(grid, width=28)
            e.insert(0, defaults.get(key, ""))
            e.grid(row=row*2+1, column=col*2, sticky="w", padx=(0, 20))
            self._issue_vars[key] = e

        # Template + SAN row
        from ca.cert_templates import TEMPLATES
        tpl_row = tk.Frame(inner, bg=PANEL)
        tpl_row.pack(fill="x", pady=(8, 0))
        tk.Label(tpl_row, text="Template:", font=("Segoe UI", 9),
                 fg=TEXT_DIM, bg=PANEL).pack(side="left")
        self._issue_template = ttk.Combobox(tpl_row, values=list(TEMPLATES.keys()),
                                            state="readonly", width=18, font=("Segoe UI", 10))
        self._issue_template.set("client_auth")
        self._issue_template.pack(side="left", padx=(4, 16))
        tk.Label(tpl_row, text="SAN (comma-sep, TLS only):", font=("Segoe UI", 9),
                 fg=TEXT_DIM, bg=PANEL).pack(side="left")
        self._issue_san = _entry(tpl_row, width=26)
        self._issue_san.pack(side="left", padx=4)

        self._issue_result = _result_box(inner, height=9)
        self._issue_result.pack(fill="x", pady=(12, 0))

        btn_row = tk.Frame(inner, bg=PANEL)
        btn_row.pack(fill="x", pady=(10, 0))
        _btn(btn_row, "Issue Certificate", self._do_issue, color=SUCCESS).pack(side="left")
        self._issue_serial_var = tk.StringVar()
        tk.Label(btn_row, textvariable=self._issue_serial_var,
                 font=("Consolas", 8), fg=ACCENT2, bg=PANEL,
                 wraplength=600, justify="left").pack(side="left", padx=12)

    def _do_issue(self):
        def task():
            try:
                from ca.ca_setup import CertificateAuthority
                from ca.csr_generator import CSRGenerator
                from ca.cert_issuer import CertificateIssuer
                from audit.audit_log import AuditLog
                from ca.crl_manager import CRLManager
                from config import CA_CONFIG

                v = {k: e.get().strip() for k, e in self._issue_vars.items()}
                if not v["name"] or not v["email"]:
                    _show(self._issue_result, "[ERROR] Name and Email are required.", DANGER)
                    return

                subject = {
                    "common_name": v["name"],
                    "email":       v["email"],
                    "org":         v["org"] or "Example Corp",
                    "org_unit":    v["org_unit"] or "Engineering",
                    "country":     v["country"] or "US",
                    "state":       v["state"] or "California",
                    "locality":    v["locality"] or "San Francisco",
                }
                days = int(v["days"]) if v["days"].isdigit() else 365

                template_name = self._issue_template.get() or "client_auth"
                san_raw   = self._issue_san.get().strip()
                san_names = [s.strip() for s in san_raw.split(",") if s.strip()] or None

                ca = CertificateAuthority()
                ca_key, ca_cert = ca.initialize()
                audit   = AuditLog(CA_CONFIG["audit_log_path"])
                issuer  = CertificateIssuer(ca_key, ca_cert, audit)

                gen  = CSRGenerator(subject)
                key  = gen.generate_key_pair()
                csr  = gen.build_csr(key)
                safe = v["name"].lower().replace(" ", "_")
                gen.save(key, csr, name=safe)
                cert = issuer.issue(csr, validity_days=days, name=safe,
                                    template_name=template_name, san_names=san_names)

                serial = cert.serial_number
                path   = os.path.join(CA_CONFIG["certs_dir"], f"{safe}_{serial}.pem")

                lines = [
                    "=" * 52,
                    "  CERTIFICATE ISSUED",
                    "=" * 52,
                    f"  Name        : {v['name']}",
                    f"  Email       : {v['email']}",
                    f"  Template    : {template_name}",
                    f"  SANs        : {san_names or 'none'}",
                    f"  Serial      : {serial}",
                    f"  Valid From  : {cert.not_valid_before_utc}",
                    f"  Valid Until : {cert.not_valid_after_utc}",
                    f"  Saved To    : {path}",
                    "=" * 52,
                    "",
                    "  Copy the serial number above to use in Verify / Revoke tabs.",
                ]
                _show(self._issue_result, "\n".join(lines), SUCCESS)
                self._issue_serial_var.set(f"Serial: {serial}")

            except Exception as e:
                _show(self._issue_result, f"[ERROR] {e}", DANGER)
        self._run(task)

    # ══════════════════════════════════════════════════════════════════════════
    # TAB 3 — Verify Certificate
    # ══════════════════════════════════════════════════════════════════════════
    def _tab_verify(self, parent):
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="both", expand=True, padx=20, pady=16)

        card, inner = _section(wrap, "Verify Certificate")
        card.pack(fill="x")

        _label(inner, "Select a .pem certificate file to verify:", color=TEXT_DIM).pack(anchor="w")

        row = tk.Frame(inner, bg=PANEL)
        row.pack(fill="x", pady=8)
        self._verify_path = _entry(row, width=55)
        self._verify_path.pack(side="left")
        _btn(row, "Browse", self._browse_cert, color="#374151", width=8).pack(side="left", padx=8)

        self._verify_result = _result_box(inner, height=12)
        self._verify_result.pack(fill="x", pady=(8, 0))

        _btn(inner, "Verify Certificate", self._do_verify, color=ACCENT2).pack(anchor="w", pady=(10, 0))

    def _browse_cert(self):
        path = filedialog.askopenfilename(
            initialdir=os.path.join(os.path.dirname(__file__), "storage", "certs"),
            title="Select Certificate",
            filetypes=[("PEM files", "*.pem"), ("All files", "*.*")]
        )
        if path:
            self._verify_path.delete(0, tk.END)
            self._verify_path.insert(0, path)

    def _do_verify(self):
        def task():
            try:
                from ca.ca_setup import CertificateAuthority
                from ca.cert_verifier import CertificateVerifier
                from ca.crl_manager import CRLManager
                from audit.audit_log import AuditLog
                from utils.crypto_utils import load_certificate
                from config import CA_CONFIG

                path = self._verify_path.get().strip()
                if not path or not os.path.exists(path):
                    _show(self._verify_result, "[ERROR] File not found.", DANGER)
                    return

                ca = CertificateAuthority()
                ca_key, ca_cert = ca.initialize()
                audit    = AuditLog(CA_CONFIG["audit_log_path"])
                crl_mgr  = CRLManager(ca_key, ca_cert, audit)
                verifier = CertificateVerifier(ca_cert, crl_mgr, audit)

                cert   = load_certificate(path)
                result = verifier.verify(cert)

                status_color = SUCCESS if result.valid else DANGER
                status_text  = "VALID" if result.valid else "INVALID"

                checks_lines = []
                for check, ok in result.checks.items():
                    mark = "[OK  ]" if ok else "[FAIL]"
                    checks_lines.append(f"  {mark}  {check}")

                lines = [
                    "=" * 52,
                    f"  RESULT: {status_text}",
                    "=" * 52,
                    f"  Subject : {result.subject}",
                    f"  Serial  : {result.serial}",
                ]
                if result.reason:
                    lines.append(f"  Reason  : {result.reason}")
                lines += ["", "  Checks:"] + checks_lines + ["=" * 52]

                _show(self._verify_result, "\n".join(lines), status_color)

            except Exception as e:
                _show(self._verify_result, f"[ERROR] {e}", DANGER)
        self._run(task)

    # ══════════════════════════════════════════════════════════════════════════
    # TAB 4 — Revoke Certificate
    # ══════════════════════════════════════════════════════════════════════════
    def _tab_revoke(self, parent):
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="both", expand=True, padx=20, pady=16)

        card, inner = _section(wrap, "Revoke Certificate")
        card.pack(fill="x")

        _label(inner, "Enter the serial number of the certificate to revoke:", color=TEXT_DIM).pack(anchor="w")

        self._revoke_serial = _entry(inner, width=55)
        self._revoke_serial.pack(anchor="w", pady=8)

        _label(inner, "Revocation Reason:", color=TEXT_DIM).pack(anchor="w")

        from ca.crl_manager import REASON_MAP
        self._revoke_reason = ttk.Combobox(inner, values=list(REASON_MAP.keys()),
                                           state="readonly", width=30,
                                           font=("Segoe UI", 10))
        self._revoke_reason.set("key_compromise")
        self._revoke_reason.pack(anchor="w", pady=(4, 12))

        self._revoke_result = _result_box(inner, height=8)
        self._revoke_result.pack(fill="x")

        _btn(inner, "Revoke Certificate", self._do_revoke, color=DANGER).pack(anchor="w", pady=(10, 0))

    def _do_revoke(self):
        def task():
            try:
                from ca.ca_setup import CertificateAuthority
                from ca.crl_manager import CRLManager
                from audit.audit_log import AuditLog
                from config import CA_CONFIG

                serial_str = self._revoke_serial.get().strip()
                reason     = self._revoke_reason.get()

                if not serial_str:
                    _show(self._revoke_result, "[ERROR] Serial number is required.", DANGER)
                    return

                serial = int(serial_str)
                ca = CertificateAuthority()
                ca_key, ca_cert = ca.initialize()
                audit   = AuditLog(CA_CONFIG["audit_log_path"])
                crl_mgr = CRLManager(ca_key, ca_cert, audit)

                if crl_mgr.is_revoked(serial):
                    _show(self._revoke_result,
                          f"[WARNING] Serial {serial} is already revoked.", WARNING)
                    return

                crl_mgr.revoke(serial, reason=reason)
                info = crl_mgr.get_revocation_info(serial)

                lines = [
                    "=" * 52,
                    "  CERTIFICATE REVOKED",
                    "=" * 52,
                    f"  Serial     : {serial}",
                    f"  Reason     : {reason}",
                    f"  Revoked At : {info['revoked_at']}",
                    "",
                    "  CRL has been rebuilt and saved.",
                    "  This certificate will now fail verification.",
                    "=" * 52,
                ]
                _show(self._revoke_result, "\n".join(lines), DANGER)

            except ValueError:
                _show(self._revoke_result, "[ERROR] Invalid serial number.", DANGER)
            except Exception as e:
                _show(self._revoke_result, f"[ERROR] {e}", DANGER)
        self._run(task)

    # ══════════════════════════════════════════════════════════════════════════
    # TAB 5 — Audit Log
    # ══════════════════════════════════════════════════════════════════════════
    def _tab_audit(self, parent):
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="both", expand=True, padx=20, pady=16)

        card, inner = _section(wrap, "Audit Log — Hash-Chained Tamper-Evident Log")
        card.pack(fill="both", expand=True)

        self._audit_status = tk.Label(inner, text="", font=("Segoe UI", 11, "bold"),
                                      fg=TEXT_DIM, bg=PANEL)
        self._audit_status.pack(anchor="w", pady=(0, 8))

        self._audit_result = _result_box(inner, height=18)
        self._audit_result.pack(fill="both", expand=True)

        _btn(inner, "Load Audit Log", self._do_audit, color=ACCENT).pack(anchor="w", pady=(10, 0))

    def _do_audit(self):
        def task():
            try:
                from audit.audit_log import AuditLog
                from config import CA_CONFIG

                audit   = AuditLog(CA_CONFIG["audit_log_path"])
                intact  = audit.verify_chain()
                entries = audit.get_log()

                status_text  = "CHAIN INTACT" if intact else "*** CHAIN TAMPERED ***"
                status_color = SUCCESS if intact else DANGER
                self._audit_status.config(text=f"  {status_text}", fg=status_color)

                lines = [
                    "=" * 64,
                    f"  AUDIT LOG  —  {len(entries)} entries",
                    f"  Chain Integrity: {status_text}",
                    "=" * 64,
                    "",
                ]
                for e in entries:
                    lines.append(f"  [{e['seq']:03d}]  {e['timestamp']}")
                    lines.append(f"         Event    : {e['event']}")
                    if "subject" in e.get("data", {}):
                        lines.append(f"         Subject  : {e['data']['subject']}")
                    if "serial" in e.get("data", {}):
                        lines.append(f"         Serial   : {e['data']['serial']}")
                    if "reason" in e.get("data", {}):
                        lines.append(f"         Reason   : {e['data']['reason']}")
                    lines.append(f"         Hash     : {e['hash'][:32]}...")
                    lines.append("")

                lines.append("=" * 64)
                _show(self._audit_result, "\n".join(lines),
                      SUCCESS if intact else DANGER)

            except Exception as e:
                _show(self._audit_result, f"[ERROR] {e}", DANGER)
        self._run(task)

    # ══════════════════════════════════════════════════════════════════════════
    # TAB 6 — CRL
    # ══════════════════════════════════════════════════════════════════════════
    def _tab_crl(self, parent):
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="both", expand=True, padx=20, pady=16)

        card, inner = _section(wrap, "Certificate Revocation List (CRL)")
        card.pack(fill="both", expand=True)

        _label(inner,
               "The CRL is a signed list of revoked certificate serial numbers.\n"
               "Any certificate on this list will fail verification.",
               color=TEXT_DIM).pack(anchor="w", pady=(0, 10))

        self._crl_result = _result_box(inner, height=16)
        self._crl_result.pack(fill="both", expand=True)

        _btn(inner, "Load / Rebuild CRL", self._do_crl, color=WARNING).pack(anchor="w", pady=(10, 0))

    def _do_crl(self):
        def task():
            try:
                from ca.ca_setup import CertificateAuthority
                from ca.crl_manager import CRLManager
                from audit.audit_log import AuditLog
                from config import CA_CONFIG

                ca = CertificateAuthority()
                ca_key, ca_cert = ca.initialize()
                audit   = AuditLog(CA_CONFIG["audit_log_path"])
                crl_mgr = CRLManager(ca_key, ca_cert, audit)
                crl     = crl_mgr.build_and_save_crl()
                revoked = list(crl)

                lines = [
                    "=" * 52,
                    f"  CRL  —  {len(revoked)} revoked certificate(s)",
                    "=" * 52,
                    "",
                ]
                if not revoked:
                    lines.append("  (no certificates have been revoked yet)")
                else:
                    for i, r in enumerate(revoked, 1):
                        lines.append(f"  [{i}]  Serial : {r.serial_number}")
                        lines.append(f"       Date   : {r.revocation_date_utc}")
                        lines.append("")

                lines += ["=" * 52, "", "  CRL saved to: storage/crl/ca.crl.pem"]
                color = DANGER if revoked else SUCCESS
                _show(self._crl_result, "\n".join(lines), color)

            except Exception as e:
                _show(self._crl_result, f"[ERROR] {e}", DANGER)
        self._run(task)


    # ══════════════════════════════════════════════════════════════════════════
    # TAB 7 — Intermediate CA
    # ══════════════════════════════════════════════════════════════════════════
    def _tab_intermediate(self, parent):
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="both", expand=True, padx=20, pady=16)

        card, inner = _section(wrap, "Intermediate Certificate Authority")
        card.pack(fill="x")

        _label(inner,
               "Real PKI hierarchy: Root CA → Intermediate CA → End-entity cert.\n"
               "The Root CA stays offline. The Intermediate CA signs day-to-day certs.\n"
               "If the Intermediate is compromised, Root revokes it without replacing the trust anchor.",
               color=TEXT_DIM).pack(anchor="w", pady=(0, 12))

        # Issue via intermediate
        _label(inner, "Issue certificate via Intermediate CA:", bold=True).pack(anchor="w", pady=(8, 4))

        grid = tk.Frame(inner, bg=PANEL)
        grid.pack(fill="x")
        self._int_vars = {}
        fields = [("Full Name *", "name"), ("Email *", "email"),
                  ("Template", "template"), ("SAN (comma-separated)", "san"),
                  ("Validity (days)", "days")]
        defaults = {"days": "365", "template": "tls_server", "san": ""}
        for i, (lbl, key) in enumerate(fields):
            tk.Label(grid, text=lbl, font=("Segoe UI", 9), fg=TEXT_DIM, bg=PANEL).grid(
                row=i*2, column=0, sticky="w", pady=(6, 0))
            e = _entry(grid, width=50)
            e.insert(0, defaults.get(key, ""))
            e.grid(row=i*2+1, column=0, sticky="w")
            self._int_vars[key] = e

        self._int_result = _result_box(inner, height=10)
        self._int_result.pack(fill="x", pady=(12, 0))

        btn_row = tk.Frame(inner, bg=PANEL)
        btn_row.pack(fill="x", pady=(10, 0))
        _btn(btn_row, "Init Intermediate CA", self._do_init_intermediate, color=ACCENT).pack(side="left")
        _btn(btn_row, "Issue via Intermediate", self._do_issue_intermediate, color=SUCCESS).pack(side="left", padx=10)

    def _do_init_intermediate(self):
        def task():
            try:
                from ca.ca_setup import CertificateAuthority
                from ca.intermediate_ca import IntermediateCA
                from audit.audit_log import AuditLog
                from config import CA_CONFIG
                ca = CertificateAuthority()
                ca_key, ca_cert = ca.initialize()
                audit = AuditLog(CA_CONFIG["audit_log_path"])
                int_ca = IntermediateCA(ca_key, ca_cert, audit)
                _, cert = int_ca.initialize()
                lines = [
                    "=" * 52, "  INTERMEDIATE CA READY", "=" * 52,
                    f"  Subject     : {cert.subject.rfc4514_string()}",
                    f"  Issuer      : {cert.issuer.rfc4514_string()}",
                    f"  Serial      : {cert.serial_number}",
                    f"  Valid From  : {cert.not_valid_before_utc}",
                    f"  Valid Until : {cert.not_valid_after_utc}",
                    f"  path_length : 0 (can only sign end-entity certs)",
                    "=" * 52,
                ]
                _show(self._int_result, "\n".join(lines), SUCCESS)
            except Exception as e:
                _show(self._int_result, f"[ERROR] {e}", DANGER)
        self._run(task)

    def _do_issue_intermediate(self):
        def task():
            try:
                from ca.ca_setup import CertificateAuthority
                from ca.intermediate_ca import IntermediateCA
                from ca.csr_generator import CSRGenerator
                from audit.audit_log import AuditLog
                from config import CA_CONFIG
                v = {k: e.get().strip() for k, e in self._int_vars.items()}
                if not v["name"] or not v["email"]:
                    _show(self._int_result, "[ERROR] Name and Email required.", DANGER)
                    return
                ca = CertificateAuthority()
                ca_key, ca_cert = ca.initialize()
                audit  = AuditLog(CA_CONFIG["audit_log_path"])
                int_ca = IntermediateCA(ca_key, ca_cert, audit)
                int_ca.initialize()
                subject = {"common_name": v["name"], "email": v["email"],
                           "org": "Example Corp", "org_unit": "Engineering",
                           "country": "US", "state": "California", "locality": "San Francisco"}
                gen  = CSRGenerator(subject)
                key  = gen.generate_key_pair()
                csr  = gen.build_csr(key)
                safe = v["name"].lower().replace(" ", "_")
                gen.save(key, csr, name=safe)
                san  = [s.strip() for s in v["san"].split(",") if s.strip()] or None
                days = int(v["days"]) if v["days"].isdigit() else 365
                cert = int_ca.issue(csr, days, safe, v["template"] or "tls_server", san)
                lines = [
                    "=" * 52, "  CERT ISSUED (via Intermediate CA)", "=" * 52,
                    f"  Subject  : {cert.subject.rfc4514_string()}",
                    f"  Serial   : {cert.serial_number}",
                    f"  Issuer   : {cert.issuer.rfc4514_string()}",
                    f"  Template : {v['template']}",
                    f"  SANs     : {san}",
                    f"  Expires  : {cert.not_valid_after_utc}",
                    "=" * 52,
                ]
                _show(self._int_result, "\n".join(lines), SUCCESS)
            except Exception as e:
                _show(self._int_result, f"[ERROR] {e}", DANGER)
        self._run(task)

    # ══════════════════════════════════════════════════════════════════════════
    # TAB 8 — Certificate Templates
    # ══════════════════════════════════════════════════════════════════════════
    def _tab_templates(self, parent):
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="both", expand=True, padx=20, pady=16)

        card, inner = _section(wrap, "Certificate Templates")
        card.pack(fill="both", expand=True)

        _label(inner,
               "Issue a certificate using a specific template profile.\n"
               "Each template sets the correct X.509 extensions for its use case.",
               color=TEXT_DIM).pack(anchor="w", pady=(0, 10))

        from ca.cert_templates import TEMPLATES
        self._tpl_result = _result_box(inner, height=20)
        self._tpl_result.pack(fill="both", expand=True)

        lines = ["=" * 60, "  AVAILABLE CERTIFICATE TEMPLATES", "=" * 60, ""]
        for name, tpl in TEMPLATES.items():
            lines.append(f"  Template    : {tpl.name}")
            lines.append(f"  Description : {tpl.description}")
            lines.append(f"  Default Days: {tpl.default_days}")
            ku = [k for k, v in tpl.key_usage.items() if v]
            lines.append(f"  Key Usage   : {', '.join(ku)}")
            eku = [str(e).split('.')[-1] for e in tpl.extended_usages]
            lines.append(f"  Ext KU      : {', '.join(eku)}")
            lines.append("")
        lines.append("=" * 60)
        lines.append("")
        lines.append("  Use the 'Issue Cert' tab and select a template,")
        lines.append("  or use the REST API: POST /api/certs/issue with \"template\": \"tls_server\"")
        _show(self._tpl_result, "\n".join(lines), ACCENT2)

    # ══════════════════════════════════════════════════════════════════════════
    # TAB 9 — ACME Auto-Renewal
    # ══════════════════════════════════════════════════════════════════════════
    def _tab_acme(self, parent):
        wrap = tk.Frame(parent, bg=BG)
        wrap.pack(fill="both", expand=True, padx=20, pady=16)

        card, inner = _section(wrap, "ACME Protocol — Automated Certificate Renewal")
        card.pack(fill="x")

        _label(inner,
               "ACME (RFC 8555) is the protocol Let's Encrypt uses to automate\n"
               "certificate issuance and renewal without human interaction.\n"
               "Start the API server first: uvicorn api.main:app --reload --port 8000",
               color=TEXT_DIM).pack(anchor="w", pady=(0, 12))

        _label(inner, "Domain:", color=TEXT_DIM).pack(anchor="w")
        self._acme_domain = _entry(inner, width=40)
        self._acme_domain.insert(0, "example.com")
        self._acme_domain.pack(anchor="w", pady=(4, 8))

        _label(inner, "Email:", color=TEXT_DIM).pack(anchor="w")
        self._acme_email = _entry(inner, width=40)
        self._acme_email.insert(0, "admin@example.com")
        self._acme_email.pack(anchor="w", pady=(4, 8))

        self._acme_result = _result_box(inner, height=14)
        self._acme_result.pack(fill="x", pady=(8, 0))

        btn_row = tk.Frame(inner, bg=PANEL)
        btn_row.pack(fill="x", pady=(10, 0))
        _btn(btn_row, "Simulate ACME Order", self._do_acme_order, color=WARNING).pack(side="left")
        _btn(btn_row, "Check Renewals Due",  self._do_acme_renewals, color=ACCENT2).pack(side="left", padx=10)

    def _do_acme_order(self):
        def task():
            try:
                import urllib.request, json
                domain = self._acme_domain.get().strip() or "example.com"
                email  = self._acme_email.get().strip() or "admin@example.com"
                payload = json.dumps({"domain": domain, "email": email, "account_key": "demo-key"}).encode()
                req = urllib.request.Request(
                    "http://localhost:8000/acme/order",
                    data=payload, method="POST",
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read())
                lines = [
                    "=" * 56, "  ACME ORDER CREATED", "=" * 56,
                    f"  Order ID      : {data.get('order_id')}",
                    f"  Domain        : {data.get('domain')}",
                    f"  Status        : {data.get('status')}",
                    f"  Token         : {data.get('token', '')[:20]}...",
                    f"  Challenge URL : {data.get('challenge_url')}",
                    f"  Validate URL  : {data.get('validate_url')}",
                    f"  Finalize URL  : {data.get('finalize_url')}",
                    f"  Expires At    : {data.get('expires_at')}",
                    "=" * 56, "",
                    "  Next: client places key_auth at the challenge URL,",
                    "  then calls validate, then submits CSR to finalize.",
                ]
                _show(self._acme_result, "\n".join(lines), SUCCESS)
            except Exception as e:
                _show(self._acme_result,
                      f"[ERROR] {e}\n\nMake sure the API server is running:\n"
                      "  uvicorn api.main:app --reload --port 8000", DANGER)
        self._run(task)

    def _do_acme_renewals(self):
        def task():
            try:
                import urllib.request, json
                url = "http://localhost:8000/acme/renewals/due?days_ahead=30"
                with urllib.request.urlopen(url, timeout=5) as resp:
                    data = json.loads(resp.read())
                if not data:
                    _show(self._acme_result, "  No certificates expiring in the next 30 days.", SUCCESS)
                    return
                lines = ["=" * 56, f"  {len(data)} CERTIFICATE(S) DUE FOR RENEWAL", "=" * 56, ""]
                for c in data:
                    lines.append(f"  Serial    : {c['serial']}")
                    lines.append(f"  Name      : {c['common_name']}")
                    lines.append(f"  Email     : {c['email']}")
                    lines.append(f"  Expires   : {c['not_after']}")
                    lines.append(f"  Days Left : {c['days_left']}")
                    lines.append("")
                _show(self._acme_result, "\n".join(lines), WARNING)
            except Exception as e:
                _show(self._acme_result,
                      f"[ERROR] {e}\n\nMake sure the API server is running:\n"
                      "  uvicorn api.main:app --reload --port 8000", DANGER)
        self._run(task)


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app = CAApp()
    app.mainloop()
