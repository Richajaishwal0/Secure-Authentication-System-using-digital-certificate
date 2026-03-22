import { useEffect, useState } from 'react'
import { api } from '../api'
import {
  RefreshCw, Trash2, ShieldCheck, ShieldOff, CheckCircle2,
  Building2, GitBranch, FileText, Link, AlertTriangle
} from 'lucide-react'

const EVENT_STYLES = {
  CERT_ISSUED:                  { color: '#4ade80', bg: 'rgba(34,197,94,0.12)',   Icon: FileText },
  CERT_REVOKED:                 { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   Icon: ShieldOff },
  CERT_VERIFIED:                { color: '#67e8f9', bg: 'rgba(6,182,212,0.12)',   Icon: ShieldCheck },
  CA_INITIALIZED:               { color: '#a78bfa', bg: 'rgba(124,58,237,0.12)', Icon: Building2 },
  INTERMEDIATE_CA_INITIALIZED:  { color: '#a78bfa', bg: 'rgba(124,58,237,0.12)', Icon: GitBranch },
}

const DEFAULT_STYLE = { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', Icon: FileText }

export default function AuditLog() {
  const [entries, setEntries] = useState([])
  const [intact, setIntact]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [filter, setFilter]   = useState('all')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.getAudit()
      setIntact(data.chain_intact)
      setEntries([...data.entries].reverse())  // newest first
    } catch {
      setEntries([])
      setIntact(null)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const eventTypes = ['all', ...new Set(entries.map(e => e.event))]
  const filtered = filter === 'all' ? entries : entries.filter(e => e.event === filter)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div className="page-title">Audit Log</div>
          <div className="page-desc">Every CA operation is recorded and cryptographically chained — tampering is detectable.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={async () => {
              if (!window.confirm('Clear all audit log entries? This cannot be undone.')) return
              await api.clearAudit()
              load()
            }}
          ><Trash2 size={13} /> Clear All</button>
        </div>
      </div>

      {/* Chain integrity banner */}
      {intact !== null && (
        <div style={{
          background: intact ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${intact ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: '12px', padding: '16px 20px', marginBottom: '1.5rem',
          display: 'flex', alignItems: 'center', gap: '14px',
        }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>{intact ? <Link size={28} color='#4ade80' /> : <AlertTriangle size={28} color='#f87171' />}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: intact ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: '14px' }}>
              Chain Integrity: {intact ? 'INTACT' : 'TAMPERED'}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>
              {intact
                ? `All ${entries.length} entries verified — SHA-256 hash chain is unbroken`
                : 'Hash chain is broken — one or more entries have been modified'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Total entries</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.2rem' }}>{entries.length}</div>
          </div>
        </div>
      )}

      {/* What is this box */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>🔬</span>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Research Feature: Tamper-Evident Logging</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '12px', lineHeight: 1.7 }}>
              Each log entry contains a SHA-256 hash of its own content plus the previous entry's hash — forming a chain. If anyone edits, deletes, or inserts an entry, the chain breaks and the system detects it. This is the same principle used in blockchain and certificate transparency logs.
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {eventTypes.map(t => {
          const s = EVENT_STYLES[t] || DEFAULT_STYLE
          return (
            <button key={t} onClick={() => setFilter(t)} style={{
              background: filter === t ? (t === 'all' ? 'rgba(124,58,237,0.2)' : s.bg) : 'var(--panel2)',
              border: `1px solid ${filter === t ? (t === 'all' ? 'rgba(124,58,237,0.4)' : s.color + '44') : 'var(--border)'}`,
              color: filter === t ? (t === 'all' ? '#c4b5fd' : s.color) : 'var(--text-muted)',
              borderRadius: '20px', padding: '4px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
            }}>
              {t === 'all' ? 'All Events' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><s.Icon size={11} />{t.replace(/_/g, ' ')}</span>}
            </button>
          )
        })}
      </div>

      {/* Entries */}
      {loading ? <div className="spinner" /> : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>📋</div>
          <div style={{ color: '#fff', fontWeight: 600 }}>No audit entries yet</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '0.4rem' }}>Actions like issuing or revoking certificates will appear here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map((e, i) => {
            const s = EVENT_STYLES[e.event] || DEFAULT_STYLE
            const isOpen = expanded === e.seq
            return (
              <div key={e.seq} style={{
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: '10px', overflow: 'hidden', transition: 'border-color 0.15s',
              }}>
                {/* Row */}
                <div onClick={() => setExpanded(isOpen ? null : e.seq)} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 16px', cursor: 'pointer',
                }}
                  onMouseEnter={e => e.currentTarget.parentElement.style.borderColor = 'rgba(255,255,255,0.12)'}
                  onMouseLeave={e => e.currentTarget.parentElement.style.borderColor = 'var(--border)'}
                >
                  {/* Seq number */}
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'monospace', minWidth: '28px' }}>
                    #{String(e.seq).padStart(3, '0')}
                  </div>

                  {/* Event badge */}
                  <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33`, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <s.Icon size={11} /> {e.event.replace(/_/g, ' ')}
                  </span>

                  {/* Subject / name */}
                  <div style={{ flex: 1, color: 'var(--text-dim)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.data?.common_name || e.data?.subject?.split('CN=')[1]?.split(',')[0] || '—'}
                  </div>

                  {/* Timestamp */}
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>
                    {e.timestamp?.slice(0, 19).replace('T', ' ')}
                  </div>

                  {/* Hash preview */}
                  <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {e.hash?.slice(0, 8)}…
                  </div>

                  <div style={{ color: 'var(--text-muted)', fontSize: '14px', transition: 'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>›</div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
                      {Object.entries(e.data || {}).map(([k, v]) => (
                        <div key={k}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{k.replace(/_/g, ' ')}</div>
                          <div style={{ color: 'var(--text-dim)', fontSize: '12px', wordBreak: 'break-all' }}>{String(v)}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', gap: '2rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '3px' }}>This Entry Hash</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: '#a78bfa' }}>{e.hash}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '3px' }}>Previous Hash</div>
                        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)' }}>{e.prev_hash?.slice(0, 32)}…</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
