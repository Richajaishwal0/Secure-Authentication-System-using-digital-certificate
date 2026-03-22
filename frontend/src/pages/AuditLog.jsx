import { useState } from 'react'
import { api } from '../api'

export default function AuditLog() {
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)

  async function handleLoad() {
    setLoading(true); setResult(''); setStatus(''); setStats(null)
    try {
      const { data } = await api.getAudit()
      const intact = data.chain_intact
      setStats({ count: data.entry_count, intact })
      const lines = [
        `Chain Integrity : ${intact ? '✓  INTACT' : '✗  TAMPERED — chain has been modified!'}`,
        `Total Entries   : ${data.entry_count}`,
        '',
        ...data.entries.flatMap(e => [
          `[${String(e.seq).padStart(3,'0')}]  ${e.timestamp}  —  ${e.event}`,
          ...(e.data?.subject ? [`       Subject  : ${e.data.subject}`] : []),
          ...(e.data?.serial  ? [`       Serial   : ${e.data.serial}`]  : []),
          ...(e.data?.reason  ? [`       Reason   : ${e.data.reason}`]  : []),
          `       Hash     : ${e.hash.slice(0,32)}…`,
          '',
        ]),
      ]
      setResult(lines.join('\n'))
      setStatus(intact ? 'success' : 'danger')
    } catch (e) {
      setResult(e.response?.data?.detail || e.message)
      setStatus('danger')
    } finally { setLoading(false) }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Audit Log</div>
        <div className="page-desc">Hash-chained tamper-evident log of every CA operation. Any modification breaks the chain.</div>
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Total Entries</div>
            <div className="stat-value">{stats.count}</div>
            <div className="stat-sub">Operations logged</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Chain Integrity</div>
            <div className="stat-value" style={{ color: stats.intact ? 'var(--success)' : 'var(--danger)' }}>
              {stats.intact ? 'Intact' : 'Tampered'}
            </div>
            <div className="stat-sub">{stats.intact ? 'All hashes verified' : 'Chain broken!'}</div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title"><span className="card-title-icon">🔐</span>Audit Log Viewer</div>
        <div className="card-divider" />
        <div className="info-box">
          <span className="info-box-icon">🔗</span>
          Each entry contains a SHA-256 hash of itself and the previous entry, forming an unbreakable chain. Tampering with any entry invalidates all subsequent hashes.
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn btn-accent" onClick={handleLoad} disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Loading…</> : '🔐  Load Audit Log'}
          </button>
        </div>
        {result && <pre className={`result-box ${status}`}>{result}</pre>}
      </div>
    </>
  )
}
