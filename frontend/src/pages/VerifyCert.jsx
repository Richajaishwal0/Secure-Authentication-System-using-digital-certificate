import { useState } from 'react'
import { api } from '../api'

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
          { id: 'verify', label: '✅ Verify a Certificate' },
          { id: 'revoke', label: '🚫 Revoke a Certificate' },
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
        <button className="btn" onClick={check} disabled={loading || !file}>
          {loading ? <><span className="btn-spinner" /> Checking…</> : '✅ Verify Certificate'}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '1.5rem', background: 'var(--panel2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{result.valid ? '✅' : '❌'}</div>
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
  const [serial, setSerial] = useState('')
  const [reason, setReason] = useState('unspecified')
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const revoke = async () => {
    if (!serial.trim()) return
    if (!confirm(`Revoke certificate ${serial.slice(0, 20)}…? This cannot be undone.`)) return
    setLoading(true); setResult(''); setStatus('')
    try {
      await api.revokeCert({ serial: serial.trim(), reason })
      setResult(`Certificate revoked successfully.\nSerial: ${serial}\nReason: ${reason}`)
      setStatus('success')
      setSerial('')
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
        Revoking a certificate immediately cancels it. Use this when someone leaves the organisation, a key is compromised, or a certificate is no longer needed. You can find the serial number in the All Certificates tab.
      </div>
      <div className="form-grid">
        <div className="form-group full">
          <label>Certificate Serial Number</label>
          <input type="text" value={serial} onChange={e => setSerial(e.target.value)}
            placeholder="Paste the serial number from the Certificates tab" />
        </div>
        <div className="form-group full">
          <label>Reason for Cancellation</label>
          <select value={reason} onChange={e => setReason(e.target.value)}>
            {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn btn-danger" onClick={revoke} disabled={loading || !serial.trim()}>
          {loading ? <><span className="btn-spinner" /> Revoking…</> : '🚫 Revoke Certificate'}
        </button>
      </div>
      {result && <pre className={`result-box ${status}`}>{result}</pre>}
    </div>
  )
}
