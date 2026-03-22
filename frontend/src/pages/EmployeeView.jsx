import { useState } from 'react'
import { api } from '../api'

const SCREENS = ['my-certs', 'request', 'check']

export default function EmployeeView({ onSwitchRole }) {
  const [screen, setScreen] = useState('my-certs')

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="header-logo">🔐</div>
          <div>
            <h1>My Certificates</h1>
            <div className="header-subtitle">Digital Identity Portal</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Logged in as Employee</span>
          <button
            onClick={onSwitchRole}
            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px' }}
          >
            Switch Role
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '4px', padding: '10px 24px' }}>
        {[
          { id: 'my-certs', icon: '🗂️', label: 'My Certificates' },
          { id: 'request',  icon: '📝', label: 'Request a Certificate' },
          { id: 'check',    icon: '✅', label: 'Check a Certificate' },
        ].map(t => (
          <button key={t.id} onClick={() => setScreen(t.id)} style={{
            background: screen === t.id ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))' : 'transparent',
            border: screen === t.id ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
            color: screen === t.id ? '#fff' : 'var(--text-dim)',
            borderRadius: '8px', padding: '8px 18px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <main style={{ flex: 1, overflow: 'auto', padding: '32px', background: 'var(--bg2)' }}>
        {screen === 'my-certs' && <MyCerts />}
        {screen === 'request'  && <RequestCert />}
        {screen === 'check'    && <CheckCert />}
      </main>
    </div>
  )
}

/* ── Screen 1: My Certificates ── */
function MyCerts() {
  const [certs, setCerts]   = useState([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.listCerts()
      setCerts(res.data)
      setLoaded(true)
    } catch {
      setCerts([])
    } finally {
      setLoading(false)
    }
  }

  const download = (cert) => {
    const blob = new Blob([cert.pem || ''], { type: 'application/x-pem-file' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${cert.common_name}_certificate.pem`
    a.click()
    URL.revokeObjectURL(url)
  }

  const daysLeft = (dateStr) => {
    if (!dateStr) return null
    const diff = new Date(dateStr) - new Date()
    return Math.floor(diff / 86400000)
  }

  if (!loaded) return (
    <div style={{ textAlign: 'center', paddingTop: '60px' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗂️</div>
      <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>Your Certificates</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>View and download all certificates issued to you.</p>
      <button className="btn" onClick={load} disabled={loading}>
        {loading ? 'Loading…' : 'Load My Certificates'}
      </button>
    </div>
  )

  if (certs.length === 0) return (
    <div style={{ textAlign: 'center', paddingTop: '60px' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
      <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>No certificates yet</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>You don't have any certificates. Request one using the tab above.</p>
      <button className="btn btn-secondary" onClick={() => setLoaded(false)}>Refresh</button>
    </div>
  )

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#fff', fontSize: '1.2rem' }}>Your Certificates ({certs.length})</h2>
        <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
      </div>

      {selected ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="card-title">📜 Certificate Details</div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>← Back</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {[
              ['Name',         selected.common_name],
              ['Email',        selected.email],
              ['Organisation', selected.org || '—'],
              ['Type',         selected.template],
              ['Issued By',    selected.issued_by],
              ['Expires',      selected.not_after?.slice(0, 10)],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{k}</div>
                <div style={{ color: '#fff', fontSize: '13px' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn" onClick={() => download(selected)} style={{ background: 'linear-gradient(135deg, var(--success), #059669)', color: '#fff' }}>
              ⬇ Download Certificate
            </button>
          </div>
          {selected.revoked && (
            <div className="output error" style={{ marginTop: '1rem' }}>
              ⚠️ This certificate has been revoked and is no longer valid.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {certs.map(c => {
            const days = daysLeft(c.not_after)
            const expiring = days !== null && days <= 30 && days > 0
            const expired  = days !== null && days <= 0
            return (
              <div key={c.serial} onClick={() => setSelected(c)} style={{
                background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px',
                padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ fontSize: '1.8rem' }}>{c.revoked ? '🚫' : expired ? '⏰' : '✅'}</div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{c.common_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{c.email} · {c.template}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {c.revoked ? (
                    <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 600 }}>Revoked</span>
                  ) : expired ? (
                    <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 600 }}>Expired</span>
                  ) : expiring ? (
                    <span style={{ color: '#facc15', fontSize: '12px', fontWeight: 600 }}>Expires in {days} days</span>
                  ) : (
                    <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 600 }}>Valid · {days}d left</span>
                  )}
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>Click to view →</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Screen 2: Request a Certificate ── */
function RequestCert() {
  const PURPOSES = [
    { value: 'vpn',    label: '🔒 VPN Access',          template: 'client_auth',   desc: 'Connect to company VPN securely' },
    { value: 'email',  label: '✉️ Email Signing',        template: 'email_signing', desc: 'Sign and encrypt your emails' },
    { value: 'web',    label: '🌐 Internal Website',     template: 'tls_server',    desc: 'HTTPS for an internal server or website' },
    { value: 'code',   label: '💻 Code Signing',         template: 'code_signing',  desc: 'Sign scripts or software you deploy' },
    { value: 'other',  label: '📋 General / Other',      template: 'client_auth',   desc: 'General purpose identity certificate' },
  ]

  const [step, setStep]     = useState(1)
  const [purpose, setPurpose] = useState(null)
  const [form, setForm]     = useState({ common_name: '', email: '', org: '', country: 'IN', san_names: [] })
  const [sanInput, setSan]  = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.common_name || !form.email) { setError('Name and email are required.'); return }
    if (form.country.length !== 2) { setError('Country must be 2 letters (e.g. IN, US).'); return }
    setLoading(true); setError('')
    try {
      const res = await api.submitRequest({
        ...form,
        template: purpose.template,
        purpose:  purpose.label,
      })
      setResult(res.data)
      setStep(3)
    } catch (e) {
      setError(e.response?.data?.detail || 'Submission failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700,
              background: step >= s ? 'linear-gradient(135deg, var(--accent), #6d28d9)' : 'var(--panel2)',
              color: step >= s ? '#fff' : 'var(--text-muted)',
              border: step === s ? '2px solid #a78bfa' : '2px solid transparent',
            }}>{s}</div>
            <span style={{ fontSize: '12px', color: step >= s ? 'var(--text)' : 'var(--text-muted)', fontWeight: step === s ? 600 : 400 }}>
              {s === 1 ? 'What do you need?' : s === 2 ? 'Your details' : 'Done'}
            </span>
            {s < 3 && <div style={{ width: 32, height: 1, background: step > s ? 'var(--accent)' : 'var(--border)' }} />}
          </div>
        ))}
      </div>

      {/* Step 1 — Purpose */}
      {step === 1 && (
        <div>
          <h2 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.2rem' }}>What do you need a certificate for?</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '13px' }}>Choose the option that best describes your use case.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {PURPOSES.map(p => (
              <div key={p.value} onClick={() => { setPurpose(p); setStep(2) }} style={{
                background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px',
                padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; e.currentTarget.style.background = 'rgba(124,58,237,0.07)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel)' }}
              >
                <div style={{ fontSize: '1.5rem' }}>{p.label.split(' ')[0]}</div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{p.label.slice(2)}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{p.desc}</div>
                </div>
                <div style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>→</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Details */}
      {step === 2 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>← Back</button>
            <div>
              <h2 style={{ color: '#fff', fontSize: '1.1rem' }}>Fill in your details</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>For: {purpose?.label}</p>
            </div>
          </div>

          {error && <div className="output error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Field label="Your Full Name *" value={form.common_name} onChange={v => set('common_name', v)} placeholder="e.g. Rahul Sharma" />
              <Field label="Your Email Address *" value={form.email} onChange={v => set('email', v)} placeholder="rahul@company.com" type="email" />
              <Field label="Organisation / Company" value={form.org} onChange={v => set('org', v)} placeholder="e.g. Acme Pvt Ltd" />
              <Field label="Country Code (2 letters)" value={form.country} onChange={v => set('country', v.toUpperCase())} placeholder="IN" maxLength={2} />

              {purpose?.template === 'tls_server' && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Domain Names</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="input" value={sanInput} onChange={e => setSan(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && sanInput.trim()) { set('san_names', [...form.san_names, sanInput.trim()]); setSan('') }}}
                      placeholder="e.g. internal.company.com" />
                    <button className="btn btn-sm" onClick={() => { if (sanInput.trim()) { set('san_names', [...form.san_names, sanInput.trim()]); setSan('') }}}>Add</button>
                  </div>
                  {form.san_names.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {form.san_names.map(s => (
                        <span key={s} className="badge" style={{ cursor: 'pointer', background: 'rgba(124,58,237,0.15)', color: '#c4b5fd' }}
                          onClick={() => set('san_names', form.san_names.filter(x => x !== s))}>
                          {s} ✕
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button className="btn" onClick={submit} disabled={loading} style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center', padding: '12px' }}>
              {loading ? 'Submitting…' : '📤 Submit Request'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Done */}
      {step === 3 && result && (
        <div style={{ textAlign: 'center', paddingTop: '20px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>
            {result.auto_approved ? '✅' : '⏳'}
          </div>
          <h2 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.3rem' }}>
            {result.auto_approved ? 'Certificate Issued!' : 'Request Submitted!'}
          </h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', lineHeight: 1.7 }}>
            {result.auto_approved
              ? 'Your certificate has been issued automatically. Go to My Certificates to download it.'
              : 'Your request has been sent to the admin for approval. You will be notified once it is approved.'}
          </p>
          {result.cert_serial && (
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '1.5rem', fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-dim)' }}>
              Certificate Serial: {result.cert_serial}
            </div>
          )}
          <button className="btn" onClick={() => { setStep(1); setPurpose(null); setForm({ common_name: '', email: '', org: '', country: 'IN', san_names: [] }); setResult(null) }}>
            Request Another
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Screen 3: Check a Certificate ── */
function CheckCert() {
  const [file, setFile]     = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const check = async () => {
    if (!file) { setError('Please select a certificate file (.pem)'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await api.verifyCert(file)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <h2 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '1.2rem' }}>Check if a Certificate is Valid</h2>
      <p style={{ color: 'var(--text-dim)', marginBottom: '2rem', fontSize: '13px', lineHeight: 1.7 }}>
        Upload a certificate file (.pem) to check if it's still valid, not expired, and not cancelled.
      </p>

      {error && <div className="output error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="card">
        <div style={{ border: '2px dashed var(--border)', borderRadius: '10px', padding: '32px', textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📄</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '1rem' }}>Select your certificate file</div>
          <input type="file" accept=".pem,.crt,.cer" onChange={e => setFile(e.target.files[0])}
            style={{ display: 'block', margin: '0 auto', maxWidth: '280px' }} />
          {file && <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '0.5rem' }}>✓ {file.name}</div>}
        </div>
        <button className="btn" onClick={check} disabled={loading || !file} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
          {loading ? 'Checking…' : '🔍 Check Certificate'}
        </button>
      </div>

      {result && (
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>{result.valid ? '✅' : '❌'}</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: result.valid ? '#4ade80' : '#f87171', marginBottom: '0.5rem' }}>
            {result.valid ? 'Certificate is Valid' : 'Certificate is NOT Valid'}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '1rem' }}>{result.subject}</div>
          {!result.valid && result.reason && (
            <div className="output error">Reason: {result.reason}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.8rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {Object.entries(result.checks || {}).map(([k, v]) => (
              <span key={k} style={{
                background: v ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: v ? '#4ade80' : '#f87171',
                border: `1px solid ${v ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600,
              }}>
                {v ? '✓' : '✗'} {k.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', maxLength }) {
  return (
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
      <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength} />
    </div>
  )
}
