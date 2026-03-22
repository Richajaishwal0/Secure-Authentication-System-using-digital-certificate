import { useState } from 'react'
import { api } from '../api'
import { CheckCircle2, XCircle, ShieldOff } from 'lucide-react'

export default function VerifyCert() {
  const [tab, setTab] = useState('verify')

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Verify & Revoke</div>
        <div className="page-desc">Check if a certificate is valid, or cancel one that is no longer needed.</div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[
          { id: 'verify', label: <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><CheckCircle2 size={14} /> Verify a Certificate</span> },
          { id: 'revoke', label: <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}><ShieldOff size={14} /> Revoke a Certificate</span> },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))' : 'var(--panel2)',
            border: tab === t.id ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border)',
            color: tab === t.id ? '#fff' : 'var(--text-dim)',
            borderRadius: '8px', padding: '9px 20px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'verify' ? <VerifyPanel /> : <RevokePanel />}
    </div>
  )
}

function VerifyPanel() {
  const [file, setFile]     = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const check = async () => {
    if (!file) { setError('Please select a .pem certificate file.'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await api.verifyCert(file)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Verification failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div className="card-title">Upload Certificate File</div>
      <div className="card-divider" />
      <div className="info-box">
        Upload a .pem certificate file. The system checks the signature, expiry date, and whether it has been revoked.
      </div>
      <div className="form-group">
        <label>Certificate File (.pem)</label>
        <input type="file" accept=".pem,.crt,.cer" onChange={e => setFile(e.target.files[0])} />
      </div>
      {error && <div className="output error" style={{ marginTop: '1rem' }}>{error}</div>}
      <div className="btn-row">
        <button className="btn" onClick={check} disabled={loading || !file} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          {loading ? <><span className="btn-spinner" /> Checking…</> : <><CheckCircle2 size={14} /> Verify Certificate</>}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '1.5rem', background: 'var(--panel2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>{result.valid ? <CheckCircle2 size={48} color='#4ade80' /> : <XCircle size={48} color='#f87171' />}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: result.valid ? '#4ade80' : '#f87171', marginBottom: '0.4rem' }}>
            {result.valid ? 'Certificate is Valid' : 'Certificate is NOT Valid'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '1rem' }}>{result.subject}</div>
          {!result.valid && result.reason && (
            <div className="output error" style={{ textAlign: 'left', marginBottom: '1rem' }}>Reason: {result.reason}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {Object.entries(result.checks || {}).map(([k, v]) => (
              <span key={k} style={{
                background: v ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                color: v ? '#4ade80' : '#f87171',
                border: `1px solid ${v ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: '20px', padding: '4px 12px', fontSize: '12px', fontWeight: 600,
              }}>
                {v ? '✓' : '✗'} {k.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const REASONS = [
  { value: 'unspecified',          label: 'Unspecified' },
  { value: 'key_compromise',       label: 'Key Compromised — private key was leaked or stolen' },
  { value: 'ca_compromise',        label: 'CA Compromised' },
  { value: 'affiliation_changed',  label: 'Person left the organisation' },
  { value: 'superseded',           label: 'Replaced by a new certificate' },
  { value: 'cessation_of_operation', label: 'Service shut down' },
]

function RevokePanel() {
  const [search, setSearch]   = useState('')
  const [matches, setMatches] = useState([])
  const [selected, setSelected] = useState(null)  // { serial, common_name, email, not_after }
  const [reason, setReason]   = useState('unspecified')
  const [result, setResult]   = useState('')
  const [status, setStatus]   = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!search.trim()) return
    setSearching(true); setMatches([]); setSelected(null)
    try {
      const res = await api.listCerts()
      const q = search.trim().toLowerCase()
      const found = res.data.filter(c =>
        !c.revoked &&
        (c.common_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.serial === search.trim())
      )
      setMatches(found)
    } catch { setMatches([]) }
    finally { setSearching(false) }
  }

  const revoke = async () => {
    if (!selected) return
    if (!confirm(`Revoke certificate for ${selected.common_name}? This cannot be undone.`)) return
    setLoading(true); setResult(''); setStatus('')
    try {
      await api.revokeCert({ serial: selected.serial, reason })
      setResult(`Certificate revoked.\nName: ${selected.common_name}\nSerial: ${selected.serial}\nReason: ${reason}`)
      setStatus('success')
      setSelected(null); setSearch(''); setMatches([])
    } catch (e) {
      setResult(e.response?.data?.detail || 'Revocation failed.')
      setStatus('danger')
    } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div className="card-title">Cancel a Certificate</div>
      <div className="card-divider" />
      <div className="info-box">
        Search by name or email to find the certificate, then select it and choose a reason.
      </div>

      {/* Search */}
      <div className="form-group" style={{ marginBottom: '0.8rem' }}>
        <label>Search by Name or Email</label>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="e.g. Alice, alice@company.com" style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={handleSearch} disabled={searching || !search.trim()}>
            {searching ? '…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      {matches.length > 0 && !selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {matches.map(c => (
            <div key={c.serial} onClick={() => setSelected(c)} style={{
              background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: '8px',
              padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{c.common_name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{c.email} · {c.template}</div>
              </div>
              <div style={{ color: '#4ade80', fontSize: '12px', fontWeight: 600 }}>Select →</div>
            </div>
          ))}
        </div>
      )}
      {matches.length === 0 && search && !searching && (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '1rem' }}>No active certificates found for "{search}".</div>
      )}

      {/* Selected cert */}
      {selected && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '12px 16px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{selected.common_name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{selected.email} · expires {selected.not_after?.slice(0, 10)}</div>
          </div>
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>
      )}

      {/* Reason */}
      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label>Reason for Cancellation</label>
        <select value={reason} onChange={e => setReason(e.target.value)}>
          {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="btn-row">
        <button className="btn btn-danger" onClick={revoke} disabled={loading || !selected} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          {loading ? <><span className="btn-spinner" /> Revoking…</> : <><ShieldOff size={14} /> Revoke Certificate</>}
        </button>
      </div>
      {result && <pre className={`result-box ${status}`}>{result}</pre>}
    </div>
  )
}
