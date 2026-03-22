import { useState } from 'react'
import { api } from '../api'

export default function VerifyCert() {
  const [file, setFile]     = useState(null)
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleVerify() {
    if (!file) { setResult('Please select a .pem certificate file.'); setStatus('danger'); return }
    setLoading(true); setResult(''); setStatus('')
    try {
      const { data } = await api.verifyCert(file)
      const checks = Object.entries(data.checks)
        .map(([k, ok]) => `  ${ok ? '✓' : '✗'}  ${k}`)
        .join('\n')
      setResult(
        `Result  : ${data.valid ? '✓  VALID' : '✗  INVALID'}\n` +
        `Subject : ${data.subject}\n` +
        `Serial  : ${data.serial}\n` +
        (data.reason ? `Reason  : ${data.reason}\n` : '') +
        `\nChecks:\n${checks}`
      )
      setStatus(data.valid ? 'success' : 'danger')
    } catch (e) {
      setResult(e.response?.data?.detail || e.message)
      setStatus('danger')
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Verify Certificate</div>
        <div className="page-desc">Upload a PEM certificate file to verify its signature, expiry, and revocation status.</div>
      </div>
      <div className="card">
        <div className="card-title"><span className="card-title-icon">✅</span>Certificate Verification</div>
        <div className="card-divider" />
        <div className="info-box">
          <span className="info-box-icon">ℹ️</span>
          Three checks are performed: signature validity (signed by this CA), expiry window, and revocation status against the CRL.
        </div>
        <div className="form-group">
          <label>Certificate File (.pem)</label>
          <input type="file" accept=".pem" onChange={e => setFile(e.target.files[0])} />
        </div>
        <div className="btn-row">
          <button className="btn btn-cyan" onClick={handleVerify} disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Verifying…</> : '✅  Verify Certificate'}
          </button>
        </div>
        {result && <pre className={`result-box ${status}`}>{result}</pre>}
      </div>
    </>
  )
}
