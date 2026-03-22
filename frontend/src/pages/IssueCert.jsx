import { useState } from 'react'
import { api } from '../api'
import { User, Settings2, FileText, Download, Copy, Mail, CheckCircle2, X, AlertTriangle } from 'lucide-react'

const TEMPLATES = ['client_auth', 'tls_server', 'email_signing', 'code_signing']

const DEFAULTS = {
  name: '', email: '', org: 'Example Corp', org_unit: 'Engineering',
  country: 'US', state: 'California', locality: 'San Francisco',
  days: '365', template: 'client_auth', san_names: '',
  use_intermediate: false,
}

export default function IssueCert() {
  const [form, setForm]       = useState(DEFAULTS)
  const [result, setResult]   = useState(null)   // issued cert data
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showSend, setShowSend] = useState(false)

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function handleIssue() {
    if (!form.name || !form.email) { setError('Name and Email are required.'); return }
    if (form.country.length !== 2) { setError('Country must be exactly 2 letters (e.g. US, IN, GB).'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const { data } = await api.issueCert({
        name: form.name, email: form.email, org: form.org,
        org_unit: form.org_unit, country: form.country,
        state: form.state, locality: form.locality,
        days: parseInt(form.days) || 365,
        template: form.template,
        san_names: form.san_names ? form.san_names.split(',').map(s => s.trim()).filter(Boolean) : [],
        use_intermediate: form.use_intermediate,
      })
      setResult({ ...data, recipientEmail: form.email, recipientName: form.name })
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  function downloadPem(pem, name, serial) {
    const blob = new Blob([pem], { type: 'application/x-pem-file' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/\s+/g, '_')}_${serial.slice(0, 8)}.pem`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Issue Certificate</div>
        <div className="page-desc">Generate a CSR and issue a signed X.509 v3 certificate for any identity.</div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={15} /> Subject Identity</div>
        <div className="card-divider" />
        <div className="form-grid">
          {[
            ['Full Name *',      'name',     'text'],
            ['Email Address *',  'email',    'email'],
            ['Organization',     'org',      'text'],
            ['Org Unit',         'org_unit', 'text'],
            ['State / Province', 'state',    'text'],
            ['City / Locality',  'locality', 'text'],
            ['Validity (days)',  'days',     'number'],
          ].map(([label, key, type]) => (
            <div className="form-group" key={key}>
              <label>{label}</label>
              <input type={type} value={form[key]} onChange={set(key)} />
            </div>
          ))}
          <div className="form-group">
            <label>Country (2-letter code)</label>
            <input type="text" value={form.country} onChange={set('country')} maxLength={2} placeholder="US" style={{ textTransform: 'uppercase' }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Settings2 size={15} /> Certificate Options</div>
        <div className="card-divider" />
        <div className="form-grid">
          <div className="form-group">
            <label>Template</label>
            <select value={form.template} onChange={set('template')}>
              {TEMPLATES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>SAN — Subject Alternative Names (TLS only)</label>
            <input type="text" value={form.san_names} onChange={set('san_names')} placeholder="example.com, www.example.com" />
          </div>
          <div className="form-group full">
            <div className="checkbox-row">
              <input type="checkbox" id="use_int" checked={form.use_intermediate} onChange={set('use_intermediate')} />
              <label htmlFor="use_int">Issue via Intermediate CA (Root → Intermediate → End-entity)</label>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#f87171', fontSize: '13px', marginBottom: '1rem' }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <div className="btn-row">
          <button className="btn btn-success" onClick={handleIssue} disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Issuing…</> : <><FileText size={14} style={{ marginRight: 6 }} />Issue Certificate</>}
          </button>
        </div>
      </div>

      {/* ── Success result card ── */}
      {result && (
        <div className="card" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <CheckCircle2 size={28} color='#4ade80' />
            <div>
              <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '15px' }}>Certificate Issued Successfully</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                Issued for <strong style={{ color: 'var(--text-dim)' }}>{result.recipientName}</strong> · Serial: <code style={{ color: 'var(--accent2)', fontSize: '11px' }}>{result.serial?.slice(0, 20)}…</code>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.2rem' }}>
            {[
              ['Template',    result.template],
              ['Issued By',   result.issued_by],
              ['Valid From',  result.not_before?.slice(0, 10)],
              ['Valid Until', result.not_after?.slice(0, 10)],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{k}</div>
                <div style={{ color: '#fff', fontSize: '13px' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Serial Number</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-dim)', wordBreak: 'break-all', background: '#080812', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px' }}>
              {result.serial}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => downloadPem(result.pem, result.recipientName, result.serial)}
              style={{ background: 'linear-gradient(135deg, var(--success), #059669)', color: '#fff', boxShadow: '0 4px 14px rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Download size={14} /> Download .pem
            </button>
            <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(result.pem)} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Copy size={14} /> Copy PEM
            </button>
            <button className="btn" onClick={() => setShowSend(true)}
              style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', color: '#fff', boxShadow: '0 4px 14px rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Mail size={14} /> Send to User
            </button>
            <button className="btn btn-secondary" onClick={() => { setResult(null); setForm(DEFAULTS) }}>
              + Issue Another
            </button>
          </div>

          {/* Raw PEM collapsed */}
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: '6px 0' }}>
              Show raw PEM certificate
            </summary>
            <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-dim)', background: '#080812', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', marginTop: '8px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {result.pem}
            </pre>
          </details>
        </div>
      )}

      {/* ── Send Modal ── */}
      {showSend && result && (
        <SendModal
          cert={result}
          onClose={() => setShowSend(false)}
        />
      )}
    </>
  )
}

/* ── Send Certificate Modal ── */
function SendModal({ cert, onClose }) {
  const [email, setEmail]     = useState(cert.recipientEmail || '')
  const [message, setMessage] = useState(`Hi,\n\nPlease find your digital certificate attached below.\n\nSerial: ${cert.serial}\nValid Until: ${cert.not_after?.slice(0, 10)}\nTemplate: ${cert.template}\n\nTo use this certificate, save the PEM content to a .pem file.\n\nRegards,\nIT Admin`)
  const [status, setStatus]   = useState('')  // '' | 'sending' | 'sent' | 'error'
  const [errMsg, setErrMsg]   = useState('')

  async function handleSend() {
    if (!email) { setErrMsg('Email is required.'); return }
    setStatus('sending'); setErrMsg('')
    try {
      await api.sendCert({ serial: cert.serial, email, message })
      setStatus('sent')
    } catch (e) {
      setErrMsg(e.response?.data?.detail || e.message)
      setStatus('error')
    }
  }

  function downloadAndClose() {
    const blob = new Blob([cert.pem], { type: 'application/x-pem-file' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${cert.recipientName?.replace(/\s+/g, '_') || 'cert'}_${cert.serial?.slice(0, 8)}.pem`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
    }}>
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '16px',
        padding: '2rem', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto',
      }}>
        {status === 'sent' ? (
          /* ── Success state ── */
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><CheckCircle2 size={48} color='#4ade80' /></div>
            <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '16px', marginBottom: '0.5rem' }}>
              Certificate Delivered
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '0.5rem' }}>
              Delivery logged to audit trail for <strong style={{ color: '#fff' }}>{email}</strong>.
            </div>
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', padding: '12px', margin: '1.2rem 0', fontSize: '12px', color: '#fbbf24', lineHeight: 1.6 }}>
              ℹ️ This system logs the delivery event. To actually email the file, use the Download button below and attach it manually, or configure an SMTP server.
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={downloadAndClose}
                style={{ background: 'linear-gradient(135deg, var(--success), #059669)', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Download size={14} /> Download .pem to Send
              </button>
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={15} /> Send Certificate to User</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                  Logs delivery to audit trail · Certificate: <code style={{ color: 'var(--accent2)' }}>{cert.serial?.slice(0, 16)}…</code>
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}><X size={18} /></button>
            </div>

            {/* Cert summary */}
            <div style={{ background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', marginBottom: '1.2rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <FileText size={24} color='var(--text-muted)' />
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{cert.subject?.split(',')[0]?.replace('CN=', '') || cert.recipientName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                  {cert.template} · Valid until {cert.not_after?.slice(0, 10)}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Recipient Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" />
            </div>

            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
              <label>Message (optional)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={7}
                style={{ width: '100%', background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-dim)', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.6 }}
              />
            </div>

            {errMsg && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '12px', marginBottom: '1rem' }}>
                ⚠ {errMsg}
              </div>
            )}

            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#fbbf24', marginBottom: '1.2rem', lineHeight: 1.6 }}>
              ℹ️ Sending logs this action to the audit trail. Download the .pem file and attach it to your email client to deliver it.
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn" onClick={handleSend} disabled={status === 'sending'}
                style={{ background: 'linear-gradient(135deg, #7c3aed, #0891b2)', color: '#fff' }}>
                {status === 'sending' ? <><span className="btn-spinner" /> Sending…</> : <><Mail size={14} style={{ marginRight: 6 }} />Log & Send</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
