import { useEffect, useState } from 'react'
import { api } from '../api'
import { RefreshCw, ShieldCheck, Clock, XCircle, AlertTriangle, Building2, Play, RotateCcw } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats]       = useState(null)
  const [expiring, setExpiring] = useState([])
  const [renewals, setRenewals] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [days, setDays]         = useState(30)

  const load = async (d = days) => {
    setLoading(true)
    setError('')
    try {
      const [s, e, r] = await Promise.all([
        api.dashStats(),
        api.dashExpiring(d),
        api.dashRenewals(),
      ])
      setStats(s.data)
      setExpiring(e.data)
      setRenewals(r.data)
    } catch {
      setError('Failed to load dashboard. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(days) }, [days])

  const triggerJob = async (job) => {
    try {
      await api.triggerJob(job)
      setTimeout(() => load(days), 1200)
    } catch {
      setError('Failed to trigger job.')
    }
  }

  if (loading) return <div className="spinner" />
  if (error) return (
    <div>
      <div className="output error" style={{ marginBottom: '1rem' }}>{error}</div>
      <button className="btn" onClick={() => load(days)}>Retry</button>
    </div>
  )

  const ca = stats?.ca

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-desc">Live overview of your certificate authority.</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => load(days)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {[
          { label: 'Total Issued',   value: stats.total,         color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
          { label: 'Active',         value: stats.active,        color: '#4ade80', bg: 'rgba(34,197,94,0.12)'  },
          { label: 'Revoked',        value: stats.revoked,       color: '#f87171', bg: 'rgba(239,68,68,0.12)'  },
          { label: 'Expired',        value: stats.expired,       color: '#fb923c', bg: 'rgba(249,115,22,0.12)' },
          { label: 'Expiring Soon',  value: stats.expiring_soon, color: '#facc15', bg: 'rgba(234,179,8,0.12)'  },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ background: s.bg, borderColor: s.color + '33' }}>
            <div className="stat-value" style={{ color: s.color, fontSize: '1.8rem', fontWeight: 800 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* CA Health */}
      <div className="card" style={{ marginTop: '1.2rem' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Building2 size={16} /> Certificate Authority Health</div>
        <div className="card-divider" />
        {ca?.error ? (
          <div className="output error">CA not initialised — go to Setup CA tab first.</div>
        ) : (
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: ca.healthy ? '#4ade80' : '#facc15', boxShadow: `0 0 8px ${ca.healthy ? '#4ade80' : '#facc15'}` }} />
            <span style={{ color: ca.healthy ? '#4ade80' : '#facc15', fontWeight: 600, fontSize: '13px' }}>
              {ca.healthy ? 'Healthy' : 'Expiring Soon'}
            </span>
          </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{ca.days_left} days until CA expires</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Expires: {ca.not_after?.slice(0, 10)}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ca.subject}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginTop: '1.2rem' }}>

        {/* Expiring certs */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="card-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={15} /> Expiring Certificates</div>
            <select value={days} onChange={e => setDays(Number(e.target.value))} style={{
              background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: '6px', padding: '4px 8px', fontSize: '12px',
            }}>
              {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          {expiring.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '1rem 0', textAlign: 'center' }}>
              ✅ No certificates expiring within {days} days            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {expiring.map(c => (
                <div key={c.serial} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>{c.common_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{c.email}</div>
                  </div>
                  <span style={{
                    background: c.days_left <= 7 ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                    color: c.days_left <= 7 ? '#f87171' : '#facc15',
                    border: `1px solid ${c.days_left <= 7 ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
                    borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700,
                  }}>
                    {c.days_left}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Automation controls */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-title" style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}><RotateCcw size={15} /> Automation</div>
          <div style={{ color: 'var(--text-dim)', fontSize: '12px', lineHeight: 1.7, marginBottom: '1rem' }}>
            The scheduler runs daily and auto-renews certificates based on your Policy Rules. Trigger manually to run immediately.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button className="btn" onClick={() => triggerJob('expiry_check')}
              style={{ background: 'linear-gradient(135deg, var(--accent), #6d28d9)', color: '#fff', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Play size={13} /> Run Expiry Check Now
            </button>
            <button className="btn" onClick={() => triggerJob('auto_renew')}
              style={{ background: 'linear-gradient(135deg, var(--success), #059669)', color: '#fff', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Play size={13} /> Run Auto-Renew Now
            </button>
          </div>
          {renewals.length > 0 && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Last Renewals</div>
              {renewals.slice(0, 3).map((r, i) => (
                <div key={i} style={{ color: 'var(--text-dim)', fontSize: '12px', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: '#4ade80' }}>↻</span> {r.common_name} — {r.renewed_at?.slice(0, 10)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Research Highlights */}
      <div className="card" style={{ marginTop: '1.2rem' }}>
        <div className="card-title">🔬 What Makes This System Different</div>
        <div className="card-divider" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[
            {
              icon: '🔗',
              title: 'Tamper-Evident Audit Log',
              desc: 'Every action is SHA-256 hash-chained. Editing any log entry breaks the chain — detectable immediately. Same principle as blockchain.',
              tag: 'Security',
              tagColor: '#a78bfa',
            },
            {
              icon: '🔄',
              title: 'Automated Certificate Renewal',
              desc: 'Background scheduler checks expiry daily. Certificates auto-renew before they expire based on configurable policies — no admin needed.',
              tag: 'Automation',
              tagColor: '#4ade80',
            },
            {
              icon: '📝',
              title: 'Self-Service Request Portal',
              desc: 'Employees request certificates without any PKI knowledge. Admins approve or reject from a queue. Removes the sysadmin bottleneck.',
              tag: 'Usability',
              tagColor: '#67e8f9',
            },
            {
              icon: '⚙️',
              title: 'Policy-Driven Lifecycle',
              desc: 'Per-template rules control max validity, auto-renewal windows, and approval requirements. The system enforces policy automatically.',
              tag: 'Research',
              tagColor: '#fbbf24',
            },
          ].map(f => (
            <div key={f.title} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>{f.icon}</span>
                <span style={{ background: f.tagColor + '22', color: f.tagColor, border: `1px solid ${f.tagColor}44`, borderRadius: '20px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>
                  {f.tag}
                </span>
              </div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px', marginBottom: '0.4rem' }}>{f.title}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
