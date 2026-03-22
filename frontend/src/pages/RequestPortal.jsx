import { useEffect, useState } from 'react'
import { api } from '../api'

const TEMPLATES = ['client_auth', 'tls_server', 'email_signing', 'code_signing']

const EMPTY = {
  common_name: '', email: '', org: '', org_unit: '',
  country: 'US', state: '', locality: '',
  template: 'client_auth', san_names: [], purpose: '',
}

export default function RequestPortal() {
  const [tab, setTab]         = useState('request')   // 'request' | 'queue'
  const [form, setForm]       = useState(EMPTY)
  const [sanInput, setSan]    = useState('')
  const [requests, setReqs]   = useState([])
  const [filter, setFilter]   = useState('pending')
  const [result, setResult]   = useState(null)
  const [msg, setMsg]         = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const loadQueue = async () => {
    try {
      const res = await api.listRequests(filter || undefined)
      setReqs(res.data)
    } catch {
      setError('Failed to load requests.')
    }
  }

  useEffect(() => { if (tab === 'queue') loadQueue() }, [tab, filter])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addSan = () => {
    const v = sanInput.trim()
    if (v && !form.san_names.includes(v)) set('san_names', [...form.san_names, v])
    setSan('')
  }

  const submit = async () => {
    if (!form.common_name || !form.email) { setError('Name and email are required.'); return }
    setLoading(true); setMsg(''); setError(''); setResult(null)
    try {
      const res = await api.submitRequest(form)
      setResult(res.data)
      setMsg(res.data.auto_approved
        ? `✅ Request auto-approved. Certificate serial: ${res.data.cert_serial}`
        : '⏳ Request submitted. Awaiting admin approval.')
      setForm(EMPTY)
    } catch (e) {
      setError(e.response?.data?.detail || 'Submission failed.')
    } finally {
      setLoading(false)
    }
  }

  const approve = async (id) => {
    try {
      await api.approveRequest(id)
      loadQueue()
    } catch (e) {
      setError(e.response?.data?.detail || 'Approve failed.')
    }
  }

  const reject = async (id) => {
    const reason = prompt('Rejection reason:')
    if (!reason) return
    try {
      await api.rejectRequest(id, reason)
      loadQueue()
    } catch {
      setError('Reject failed.')
    }
  }

  const statusColor = { pending: 'dot-yellow', approved: 'dot-green', rejected: 'dot-red' }

  return (
    <div>
      <h2 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>Certificate Request Portal</h2>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['request', 'queue'].map(t => (
          <button key={t} className={`btn ${tab === t ? '' : 'btn-secondary'}`} onClick={() => setTab(t)}>
            {t === 'request' ? '📝 Request Certificate' : '📋 Admin Queue'}
          </button>
        ))}
      </div>

      {msg   && <div className="output success" style={{ marginBottom: '1rem' }}>{msg}</div>}
      {error && <div className="output error"   style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* ── Request form ── */}
      {tab === 'request' && (
        <div className="card">
          <div className="card-title">Request a Certificate</div>
          <div className="info-box" style={{ marginBottom: '1rem' }}>
            Fill in your details. If the policy for your chosen template requires approval, an admin will review your request.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name *</label>
              <input className="input" value={form.common_name} onChange={e => set('common_name', e.target.value)} placeholder="Alice Smith" />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="alice@example.com" />
            </div>
            <div className="form-group">
              <label>Organisation</label>
              <input className="input" value={form.org} onChange={e => set('org', e.target.value)} placeholder="Acme Corp" />
            </div>
            <div className="form-group">
              <label>Department</label>
              <input className="input" value={form.org_unit} onChange={e => set('org_unit', e.target.value)} placeholder="Engineering" />
            </div>
            <div className="form-group">
              <label>Country</label>
              <input className="input" value={form.country} onChange={e => set('country', e.target.value)} maxLength={2} placeholder="US" />
            </div>
            <div className="form-group">
              <label>Certificate Type</label>
              <select className="input" value={form.template} onChange={e => set('template', e.target.value)}>
                {TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Purpose (why do you need this certificate?)</label>
              <input className="input" value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="e.g. VPN access, email signing for client communications" />
            </div>
            {form.template === 'tls_server' && (
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Domain Names (SANs)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input className="input" value={sanInput} onChange={e => setSan(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSan()} placeholder="example.com" />
                  <button className="btn btn-sm" onClick={addSan}>Add</button>
                </div>
                {form.san_names.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {form.san_names.map(s => (
                      <span key={s} className="badge" style={{ cursor: 'pointer' }}
                        onClick={() => set('san_names', form.san_names.filter(x => x !== s))}>
                        {s} ✕
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button className="btn" onClick={submit} disabled={loading} style={{ marginTop: '1rem' }}>
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      )}

      {/* ── Admin queue ── */}
      {tab === 'queue' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Approval Queue</div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['pending', 'approved', 'rejected', ''].map(s => (
                <button key={s} className={`btn btn-sm ${filter === s ? '' : 'btn-secondary'}`}
                  onClick={() => setFilter(s)}>
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="info-box">No {filter} requests found.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Template</th><th>Purpose</th><th>Status</th><th>Submitted</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td>{r.common_name}</td>
                    <td>{r.email}</td>
                    <td><span className="badge">{r.template}</span></td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={r.purpose}>{r.purpose || '—'}</td>
                    <td>
                      <span className={`status-dot ${statusColor[r.status] || ''}`} />
                      {r.status}
                      {r.reject_reason && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> — {r.reject_reason}</span>}
                    </td>
                    <td>{r.created_at?.slice(0, 10)}</td>
                    <td>
                      {r.status === 'pending' && (
                        <>
                          <button className="btn btn-sm" onClick={() => approve(r.id)} style={{ marginRight: '0.4rem' }}>✅ Approve</button>
                          <button className="btn btn-sm btn-danger" onClick={() => reject(r.id)}>❌ Reject</button>
                        </>
                      )}
                      {r.issued_serial && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          Serial: {r.issued_serial.slice(0, 12)}…
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
