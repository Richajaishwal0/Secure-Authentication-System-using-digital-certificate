import { useState } from 'react'
import { api } from '../api'
import { FileText, RefreshCw } from 'lucide-react'

export default function CRL() {
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(null)

  async function handleLoad() {
    setLoading(true); setResult(''); setStatus('')
    try {
      const { data } = await api.rebuildCRL()
      setCount(data.revoked_count)
      const lines = [
        `Revoked Certificates : ${data.revoked_count}`,
        `CRL Saved To         : storage/crl/ca.crl.pem`,
        '',
        ...(data.entries.length === 0
          ? ['  No certificates have been revoked yet.']
          : data.entries.flatMap((r, i) => [
              `[${i+1}]  Serial : ${r.serial}`,
              `     Date   : ${r.date}`,
              '',
            ])
        ),
      ]
      setResult(lines.join('\n'))
      setStatus(data.revoked_count > 0 ? 'danger' : 'success')
    } catch (e) {
      setResult(e.response?.data?.detail || e.message)
      setStatus('danger')
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Certificate Revocation List</div>
        <div className="page-desc">A signed list of revoked certificate serial numbers. Any certificate on this list will fail verification.</div>
      </div>
      <div className="card">
        <div className="card-title">
          <span className="card-title-icon"><FileText size={15} /></span>CRL Management
          {count !== null && (
            <span className={`badge ${count > 0 ? 'badge-danger' : 'badge-success'}`} style={{ marginLeft: 'auto' }}>
              {count} revoked
            </span>
          )}
        </div>
        <div className="card-divider" />
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn btn-warning" onClick={handleLoad} disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Rebuilding…</> : <><RefreshCw size={14} style={{ marginRight: 6 }} />Load / Rebuild CRL</>}
          </button>
        </div>
        {result && <pre className={`result-box ${status}`}>{result}</pre>}
      </div>
    </>
  )
}
