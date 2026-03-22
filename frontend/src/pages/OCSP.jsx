import { useState } from 'react'
import { api } from '../api'
import { Search, Info } from 'lucide-react'

export default function OCSP() {
  const [serial, setSerial] = useState('')
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCheck() {
    if (!serial.trim()) return
    setLoading(true); setResult(''); setStatus('')
    try {
      const { data } = await api.ocspStatus(serial.trim())
      const isRevoked = data.status === 'REVOKED'
      setResult(
        `Serial  : ${data.serial}\n` +
        `Status  : ${isRevoked ? '✗  REVOKED' : '✓  GOOD'}\n` +
        (data.revocation ? `Reason  : ${data.revocation.reason}\nDate    : ${data.revocation.revoked_at}\n` : '') +
        `\n${isRevoked
          ? 'This certificate has been revoked and should not be trusted.'
          : 'This certificate is valid and has not been revoked.'}`
      )
      setStatus(isRevoked ? 'danger' : 'success')
    } catch (e) {
      setResult(e.response?.data?.detail || e.message)
      setStatus('danger')
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">OCSP Status Check</div>
        <div className="page-desc">Online Certificate Status Protocol — real-time revocation check without downloading the full CRL.</div>
      </div>
      <div className="card">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Search size={15} /> Certificate Status</div>
        <div className="card-divider" />
        <div className="info-box">
          <Info size={14} style={{ flexShrink: 0 }} />
          The OCSP responder is also available at <code style={{ color: 'var(--accent2)' }}>POST /ocsp</code> in DER format (RFC 6960),
          which is what browsers and TLS libraries use automatically.
        </div>
        <div className="form-group">
          <label>Serial Number</label>
          <input type="text" value={serial} onChange={e => setSerial(e.target.value)}
            placeholder="Enter certificate serial number" />
        </div>
        <div className="btn-row">
          <button className="btn btn-cyan" onClick={handleCheck} disabled={loading || !serial.trim()}>
            {loading ? <><span className="btn-spinner" /> Checking…</> : <><Search size={14} style={{ marginRight: 6 }} />Check OCSP Status</>}
          </button>
        </div>
        {result && <pre className={`result-box ${status}`}>{result}</pre>}
      </div>
    </>
  )
}
