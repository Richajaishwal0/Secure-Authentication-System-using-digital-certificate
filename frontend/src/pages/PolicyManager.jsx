import { useEffect, useState } from 'react'
import { api } from '../api'

const TEMPLATES = ['client_auth', 'tls_server', 'email_signing', 'code_signing']

const DEFAULT = {
  template: 'client_auth',
  max_validity_days: 365,
  auto_renew: false,
  renew_days_before_expiry: 30,
  warn_days_before_expiry: 30,
  require_approval: false,
  allowed_sans: true,
  description: '',
}

export default function PolicyManager() {
  const [policies, setPolicies] = useState([])
  const [form, setForm]         = useState(DEFAULT)
  const [editing, setEditing]   = useState(false)
  const [msg, setMsg]           = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const load = async () => {
    try {
      const res = await api.listPolicies()
      setPolicies(res.data)
    } catch {
      setError('Failed to load policies.')
    }
  }

  useEffect(() => { load() }, [])

  const startEdit = (p) => {
    setForm({ ...p })
    setEditing(true)
    setMsg('')
    setError('')
  }

  const startNew = () => {
    setForm(DEFAULT)
    setEditing(true)
    setMsg('')
    setError('')
  }

  const save = async () => {
    setLoading(true)
    setMsg('')
    setError('')
    try {
      await api.upsertPolicy(form)
      setMsg(`Policy for '${form.template}' saved.`)
      setEditing(false)
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  const remove = async (tmpl) => {
    if (!confirm(`Delete policy for '${tmpl}'?`)) return
    try {
      await api.deletePolicy(tmpl)
      load()
    } catch {
      setError('Delete failed.')
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem' }}>Policy Manager</h2>
        <button className="btn" onClick={startNew}>+ New Policy</button>
      </div>

      <div className="info-box" style={{ marginBottom: '1.5rem' }}>
        Policies control how certificates are issued per template — max validity, auto-renewal, approval requirements, and expiry warnings.
      </div>

      {msg   && <div className="output success" style={{ marginBottom: '1rem' }}>{msg}</div>}
      {error && <div className="output error"   style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Policy list */}
      {policies.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-title">Active Policies</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Template</th><th>Max Days</th><th>Auto-Renew</th>
                <th>Renew Before</th><th>Approval</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map(p => (
                <tr key={p.template}>
                  <td><span className="badge">{p.template}</span></td>
                  <td>{p.max_validity_days}d</td>
                  <td>
                    <span className={`status-dot ${p.auto_renew ? 'dot-green' : 'dot-grey'}`} />
                    {p.auto_renew ? 'Yes' : 'No'}
                  </td>
                  <td>{p.renew_days_before_expiry}d</td>
                  <td>
                    <span className={`status-dot ${p.require_approval ? 'dot-yellow' : 'dot-green'}`} />
                    {p.require_approval ? 'Required' : 'Auto'}
                  </td>
                  <td>
                    <button className="btn btn-sm" onClick={() => startEdit(p)} style={{ marginRight: '0.5rem' }}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(p.template)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / create form */}
      {editing && (
        <div className="card">
          <div className="card-title">{form.id ? `Edit Policy — ${form.template}` : 'New Policy'}</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Template</label>
              <select value={form.template} onChange={e => set('template', e.target.value)} className="input">
                {TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Max Validity (days)</label>
              <input type="number" className="input" value={form.max_validity_days}
                onChange={e => set('max_validity_days', Number(e.target.value))} min={1} max={3650} />
            </div>
            <div className="form-group">
              <label>Warn Before Expiry (days)</label>
              <input type="number" className="input" value={form.warn_days_before_expiry}
                onChange={e => set('warn_days_before_expiry', Number(e.target.value))} min={1} />
            </div>
            <div className="form-group">
              <label>Renew Before Expiry (days)</label>
              <input type="number" className="input" value={form.renew_days_before_expiry}
                onChange={e => set('renew_days_before_expiry', Number(e.target.value))} min={1} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input type="text" className="input" value={form.description}
                onChange={e => set('description', e.target.value)} placeholder="Optional note" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', margin: '1rem 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.auto_renew}
                onChange={e => set('auto_renew', e.target.checked)} />
              <span>Auto-Renew (scheduler re-issues before expiry)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.require_approval}
                onChange={e => set('require_approval', e.target.checked)} />
              <span>Require Admin Approval for new requests</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.allowed_sans}
                onChange={e => set('allowed_sans', e.target.checked)} />
              <span>Allow SANs</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn" onClick={save} disabled={loading}>
              {loading ? 'Saving…' : 'Save Policy'}
            </button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
