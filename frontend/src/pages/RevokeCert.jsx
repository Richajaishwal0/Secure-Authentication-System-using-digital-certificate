import { useState } from 'react'
import { api } from '../api'
import { ShieldOff, AlertTriangle } from 'lucide-react'

const REASONS = [
  'unspecified', 'key_compromise', 'ca_compromise',
  'affiliation_changed', 'superseded',
  'cessation_of_operation', 'privilege_withdrawn',
]

export default function RevokeCert() {
  const [serial, setSerial] = useState('')
  const [reason, setReason] = useState('key_compromise')
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRevoke() {
    if (!serial.trim()) { setResult('Serial number is required.'); setStatus('danger'); return }
    setLoading(true); setResult(''); setStatus('')
    try {
      const { data } = await api.revokeCert({ serial: serial.trim(), reason })
      setResult(
        `Serial  : ${data.serial}\n` +
        `Reason  : ${data.reason}\n\n` +
        `✓  CRL has been rebuilt and saved.\n` +
        `   This certificate will now fail verification.`
      )
      setStatus('danger')
    } catch (e) {
      setResult(e.response?.data?.detail || e.message)
      setStatus(e.response?.status === 409 ? 'warning' : 'danger')
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Revoke Certificate</div>
        <div className="page-desc">Permanently revoke a certificate by serial number. The CRL will be rebuilt immediately.</div>
      </div>
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldOff size={15} /> Revoke Certificate</div>
        <div className="card-divider" />
        <div className="info-box" style={{ background: 'rgba(239,68,68,0.07)', borderColor: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginRight: 6 }} />
          This action is irreversible. Once revoked, the certificate will fail all future verification checks.
        </div>
        <div className="form-grid">
          <div className="form-group full">
            <label>Serial Number *</label>
            <input type="text" value={serial} onChange={e => setSerial(e.target.value)}
              placeholder="Paste the certificate serial number" />
          </div>
          <div className="form-group">
            <label>Revocation Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)}>
              {REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-danger" onClick={handleRevoke} disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Revoking…</> : <><ShieldOff size={14} style={{ marginRight: 6 }} />Revoke Certificate</>}
          </button>
        </div>
        {result && <pre className={`result-box ${status}`}>{result}</pre>}
      </div>
    </>
  )
}
