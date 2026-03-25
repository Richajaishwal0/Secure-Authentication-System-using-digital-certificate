import { useEffect, useState } from 'react'
import { api } from '../api'
import { RefreshCw, Download, Key, Copy, Trash2, CheckCircle2, XCircle, AlertTriangle, Clock, ChevronRight, Search } from 'lucide-react'

const TEMPLATE_COLORS = {
  client_auth:   { bg: 'rgba(124,58,237,0.15)',  text: '#a78bfa' },
  tls_server:    { bg: 'rgba(6,182,212,0.15)',   text: '#67e8f9' },
  email_signing: { bg: 'rgba(16,185,129,0.15)',  text: '#4ade80' },
  code_signing:  { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24' },
}

export default function Certificates() {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail]   = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')  // all | active | revoked
  const [deleteTarget, setDeleteTarget] = useState(null)  // serial to delete

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.listCerts()
      setList(data)
    } catch { setList([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openDetail = async (cert) => {
    setSelected(cert)
    setDetailLoading(true)
    setDetail(null)
    try {
      const { data } = await api.getCert(cert.serial)
      setDetail(data)
    } catch { setDetail(null) }
    finally { setDetailLoading(false) }
  }

  const download = (cert) => {
    const blob = new Blob([cert.pem], { type: 'application/x-pem-file' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${cert.common_name.replace(/\s+/g, '_')}_${cert.serial.slice(0,8)}.pem`
    a.click()
    URL.revokeObjectURL(url)
  }

  const daysLeft = (dateStr) => {
    if (!dateStr) return null
    return Math.floor((new Date(dateStr) - new Date()) / 86400000)
  }

  const filtered = list.filter(c => {
    const matchSearch = !search ||
      c.common_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ? true :
      filter === 'active'  ? !c.revoked :
      filter === 'revoked' ? c.revoked  : true
    return matchSearch && matchFilter
  })

  // ── Detail panel ──
  if (selected) {
    const days = daysLeft(detail?.not_after)
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(null); setDetail(null) }}>
            ← All Certificates
          </button>
          <h2 style={{ color: '#fff', fontSize: '1.1rem' }}>{selected.common_name}</h2>
        </div>

        {detailLoading ? <div className="spinner" /> : detail && (
          <>
            {/* Status banner */}
            <div style={{
              background: detail.revoked ? 'rgba(239,68,68,0.1)' : days !== null && days <= 30 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
              border: `1px solid ${detail.revoked ? 'rgba(239,68,68,0.3)' : days !== null && days <= 30 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}`,
              borderRadius: '10px', padding: '14px 18px', marginBottom: '1.5rem',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              {detail.revoked ? <XCircle size={24} color='#f87171' /> : days !== null && days <= 0 ? <Clock size={24} color='#f87171' /> : days !== null && days <= 30 ? <AlertTriangle size={24} color='#facc15' /> : <CheckCircle2 size={24} color='#4ade80' />}
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>
                  {detail.revoked ? 'Certificate Revoked' : days !== null && days <= 0 ? 'Certificate Expired' : days !== null && days <= 30 ? `Expiring in ${days} days` : 'Certificate Valid'}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                  {detail.revoked ? `Reason: ${detail.revocation?.reason} · Revoked: ${detail.revocation?.revoked_at?.slice(0,10)}` : `Valid until ${detail.not_after?.slice(0,10)}`}
                </div>
              </div>
            </div>

            {/* Info grid */}
            <div className="card">
              <div className="card-title">📋 Certificate Details</div>
              <div className="card-divider" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem' }}>
                {[
                  ['Common Name',  detail.common_name],
                  ['Email',        detail.email],
                  ['Organisation', detail.org || '—'],
                  ['Template',     detail.template],
                  ['Issued By',    detail.issued_by],
                  ['Valid From',   detail.not_before?.slice(0,10)],
                  ['Valid Until',  detail.not_after?.slice(0,10)],
                  ['Days Left',    days !== null ? (days > 0 ? `${days} days` : 'Expired') : '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{k}</div>
                    <div style={{ color: '#fff', fontSize: '13px' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Serial Number</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-dim)', wordBreak: 'break-all' }}>{detail.serial}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="card">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Download size={15} /> Certificate Actions</div>
              <div className="card-divider" />
              <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => download(detail)}
                  style={{ background: 'linear-gradient(135deg, var(--success), #059669)', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Download size={14} /> Download Certificate
                </button>
                {detail.private_key_pem && (
                  <button className="btn" onClick={() => {
                    const blob = new Blob([detail.private_key_pem], { type: 'application/x-pem-file' })
                    const url  = URL.createObjectURL(blob)
                    const a    = document.createElement('a')
                    a.href     = url
                    a.download = `${detail.common_name?.replace(/\s+/g,'_')}_${detail.serial?.slice(0,8)}_private_key.pem`
                    a.click()
                    URL.revokeObjectURL(url)
                  }} style={{ background: 'linear-gradient(135deg, #b45309, #92400e)', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Key size={14} /> Download Private Key
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(detail.pem)} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Copy size={14} /> Copy PEM
                </button>
                <button className="btn" onClick={() => setDeleteTarget(detail.serial)}
                  style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>

            </div>

            {/* Raw PEM — collapsed by default */}
            <details style={{ marginTop: '0.5rem' }}>
              <summary style={{ color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', padding: '8px 0' }}>
                Show raw PEM certificate
              </summary>
              <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-dim)', background: '#080812', border: '1px solid var(--border)', borderRadius: '8px', padding: '14px', marginTop: '8px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {detail.pem}
              </pre>
            </details>
          </>
        )}
      </div>
    )
  }

  // ── List view ──
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <div className="page-title">All Certificates</div>
          <div className="page-desc">Click any certificate to view details and download.</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.2rem', alignItems: 'center' }}>
        <input
          className="input" placeholder="Search by name or email…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          {['all', 'active', 'revoked'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))' : 'var(--panel2)',
              border: filter === f ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border)',
              color: filter === f ? '#fff' : 'var(--text-dim)',
              borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: 'auto' }}>
          {filtered.length} of {list.length}
        </span>
      </div>

      {loading ? <div className="spinner" /> : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>📭</div>
          <div style={{ color: '#fff', fontWeight: 600, marginBottom: '0.4rem' }}>No certificates found</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {list.length === 0 ? 'Issue a certificate first from the Issue Certificate tab.' : 'Try changing the search or filter.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {filtered.map(c => {
            const days = daysLeft(c.not_after)
            const tc   = TEMPLATE_COLORS[c.template] || TEMPLATE_COLORS.client_auth
            return (
              <div key={c.serial} onClick={() => openDetail(c)} style={{
                background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '12px',
                padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '16px', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.background = 'rgba(124,58,237,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel)' }}
              >
                {c.revoked ? <XCircle size={22} color='#f87171' /> : days !== null && days <= 0 ? <Clock size={22} color='#f87171' /> : days !== null && days <= 30 ? <AlertTriangle size={22} color='#facc15' /> : <CheckCircle2 size={22} color='#4ade80' />}

                {/* Name + email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{c.common_name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{c.email}</div>
                </div>

                {/* Template badge */}
                <span style={{ background: tc.bg, color: tc.text, border: `1px solid ${tc.text}33`, borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                  {c.template}
                </span>

                {/* Expiry */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {c.revoked ? (
                    <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 600 }}>Revoked</span>
                  ) : days !== null && days <= 0 ? (
                    <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 600 }}>Expired</span>
                  ) : days !== null && days <= 30 ? (
                    <span style={{ color: '#facc15', fontSize: '12px', fontWeight: 600 }}>{days}d left</span>
                  ) : (
                    <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 600 }}>{days}d left</span>
                  )}
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>{c.not_after?.slice(0,10)}</div>
                </div>

                <ChevronRight size={18} color='var(--text-muted)' style={{ flexShrink: 0 }} />
                <button
                  onClick={e => { e.stopPropagation(); setDeleteTarget(c.serial) }}
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          serial={deleteTarget}
          cert={list.find(c => c.serial === deleteTarget)}
          onConfirm={async () => {
            await api.deleteCert(deleteTarget)
            setDeleteTarget(null)
            setSelected(null)
            setDetail(null)
            load()
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

function DeleteModal({ serial, cert, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleDelete = async () => {
    setLoading(true); setError('')
    try { await onConfirm() }
    catch (e) { setError(e.response?.data?.detail || 'Delete failed.'); setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ background: 'var(--panel)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '400px' }}>
        <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '1rem' }}>🗑</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', textAlign: 'center', marginBottom: '0.5rem' }}>Delete Certificate?</div>
        <div style={{ color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center', marginBottom: '0.8rem', lineHeight: 1.6 }}>
          This will permanently remove <strong style={{ color: '#fff' }}>{cert?.common_name}</strong>'s certificate from the database.
        </div>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#f87171', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          ⚠ This cannot be undone. If the certificate is still in use, revoke it instead.
        </div>
        {error && <div style={{ color: '#f87171', fontSize: '13px', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn" onClick={handleDelete} disabled={loading}
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff' }}>
            {loading ? <><span className="btn-spinner" /> Deleting…</> : 'Delete Certificate'}
          </button>
        </div>
      </div>
    </div>
  )
}
