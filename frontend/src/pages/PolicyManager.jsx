import { useEffect, useState } from 'react'
import { api } from '../api'
import { Lock, Globe, Mail, Code2, FileText, Pencil, Trash2, CheckCircle2, Save, X } from 'lucide-react'

const TEMPLATES = ['client_auth', 'tls_server', 'email_signing', 'code_signing']

const TEMPLATE_LABEL = {
  client_auth:   { Icon: Lock,  label: 'Client Auth',   desc: 'VPN, device identity' },
  tls_server:    { Icon: Globe, label: 'TLS Server',    desc: 'HTTPS, internal websites' },
  email_signing: { Icon: Mail,  label: 'Email Signing', desc: 'Sign & encrypt emails' },
  code_signing:  { Icon: Code2, label: 'Code Signing',  desc: 'Sign scripts & software' },
}

const DEFAULT = {
  template: 'client_auth',
  max_validity_days: 365,
  auto_renew: false,
  renew_days_before_expiry: 30,
  warn_days_before_expiry: 30,
  require_approval: true,
  allowed_sans: true,
  description: '',
}

export default function PolicyManager() {
  const [policies, setPolicies]     = useState([])
  const [form, setForm]             = useState(null)   // null = no form open
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [msg, setMsg]               = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  const load = async () => {
    try {
      const res = await api.listPolicies()
      setPolicies(res.data)
    } catch {
      setError('Failed to load policies.')
    }
  }

  useEffect(() => { load() }, [])

  const openEdit = (p) => { setForm({ ...p }); setMsg(''); setError('') }
  const openNew  = () => { setForm({ ...DEFAULT }); setMsg(''); setError('') }

  const save = async () => {
    setLoading(true); setMsg(''); setError('')
    try {
      await api.upsertPolicy(form)
      setMsg(`Policy for "${TEMPLATE_LABEL[form.template]?.label || form.template}" saved.`)
      setForm(null)
      load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed.')
    } finally { setLoading(false) }
  }

  const confirmDelete = async () => {
    try {
      await api.deletePolicy(deleteTarget)
      setDeleteTarget(null)
      load()
    } catch {
      setError('Delete failed.')
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Templates that don't have a policy yet
  const existingTemplates = policies.map(p => p.template)
  const availableTemplates = form?.template && !existingTemplates.includes(form.template)
    ? TEMPLATES
    : TEMPLATES.filter(t => !existingTemplates.includes(t) || t === form?.template)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Policy Rules</div>
        <div className="page-desc">
          Control how certificates are issued per template — validity limits, approval requirements, and auto-renewal.
        </div>
      </div>

      {msg   && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', padding: '10px 16px', color: '#4ade80', fontSize: '13px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '7px' }}><CheckCircle2 size={14} /> {msg}</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.1)',  border: '1px solid rgba(239,68,68,0.3)',  borderRadius: '8px', padding: '10px 16px', color: '#f87171', fontSize: '13px', marginBottom: '1rem' }}>⚠ {error}</div>}

      {/* Policy cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {policies.map(p => {
          const meta = TEMPLATE_LABEL[p.template] || { icon: '📋', label: p.template, desc: '' }
          return (
            <div key={p.template} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
              {/* Card header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {meta.Icon && <meta.Icon size={22} color='#a78bfa' />}
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>{meta.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{meta.desc}</div>
                </div>
              </div>

              {/* Policy values */}
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Row label="Max Validity"     value={`${p.max_validity_days} days`} />
                <Row label="Warn Before"      value={`${p.warn_days_before_expiry} days before expiry`} />
                <Row label="Renew Before"     value={`${p.renew_days_before_expiry} days before expiry`} />
                <Row label="Auto-Renew" value={p.auto_renew ? 'On' : '—'} highlight={p.auto_renew} />
                <Row label="Approval" value={p.require_approval ? 'Required' : 'Auto-approve'} highlight={!p.require_approval} />
                <Row label="SANs Allowed"     value={p.allowed_sans ? 'Yes' : 'No'} />
                {p.description && <Row label="Note" value={p.description} />}
              </div>

              {/* Actions */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', background: 'rgba(0,0,0,0.1)' }}>
                <button className="btn btn-sm" onClick={() => openEdit(p)}
                  style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Pencil size={13} /> Edit
                </button>
                <button className="btn btn-sm" onClick={() => setDeleteTarget(p.template)}
                  style={{ flex: 1, justifyContent: 'center', borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          )
        })}

        {/* Add new policy card */}
        <div onClick={openNew} style={{
          background: 'var(--panel)', border: '2px dashed var(--border)', borderRadius: '14px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '2rem', cursor: 'pointer', minHeight: '200px', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'; e.currentTarget.style.background = 'rgba(124,58,237,0.05)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--panel)' }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>＋</div>
          <div style={{ color: 'var(--text-dim)', fontWeight: 600, fontSize: '14px' }}>Add Policy</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Set rules for a template</div>
        </div>
      </div>

      {/* Edit / Create Modal */}
      {form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                {existingTemplates.includes(form.template) ? `Edit Policy — ${TEMPLATE_LABEL[form.template]?.label || form.template}` : 'New Policy'}
              </div>
              <button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div className="form-grid">
              <div className="form-group full">
                <label>Template</label>
                <select value={form.template} onChange={e => set('template', e.target.value)}
                  style={{ width: '100%', background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '13px', outline: 'none' }}>
                  {TEMPLATES.map(t => (
                    <option key={t} value={t} disabled={existingTemplates.includes(t) && t !== form.template}>
                      {TEMPLATE_LABEL[t]?.icon} {TEMPLATE_LABEL[t]?.label || t} {existingTemplates.includes(t) && t !== form.template ? '(already has policy)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Max Validity (days)</label>
                <input type="number" value={form.max_validity_days}
                  onChange={e => set('max_validity_days', Number(e.target.value))} min={1} max={3650} />
              </div>
              <div className="form-group">
                <label>Warn Before Expiry (days)</label>
                <input type="number" value={form.warn_days_before_expiry}
                  onChange={e => set('warn_days_before_expiry', Number(e.target.value))} min={1} />
              </div>
              <div className="form-group">
                <label>Renew Before Expiry (days)</label>
                <input type="number" value={form.renew_days_before_expiry}
                  onChange={e => set('renew_days_before_expiry', Number(e.target.value))} min={1} />
              </div>
              <div className="form-group full">
                <label>Description (optional)</label>
                <input type="text" value={form.description}
                  onChange={e => set('description', e.target.value)} placeholder="e.g. Used for employee VPN access" />
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', margin: '1.2rem 0' }}>
              {[
                ['require_approval', '⏳ Require Admin Approval', 'New requests must be manually approved by admin'],
                ['auto_renew',       '🔄 Auto-Renew',             'Scheduler automatically renews certs before expiry'],
                ['allowed_sans',     '🌐 Allow SANs',             'Allow Subject Alternative Names in certificates'],
              ].map(([key, label, hint]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '10px 14px', background: 'var(--panel2)', borderRadius: '8px', border: `1px solid ${form[key] ? 'rgba(124,58,237,0.3)' : 'var(--border)'}` }}>
                  <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)}
                    style={{ width: 16, height: 16, marginTop: 2, cursor: 'pointer', flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>{hint}</div>
                  </div>
                </label>
              ))}
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '13px', marginBottom: '1rem' }}>⚠ {error}</div>}

            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn" onClick={save} disabled={loading}>
                {loading ? <><span className="btn-spinner" /> Saving…</> : <><Save size={14} style={{ marginRight: 6 }} />Save Policy</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'var(--panel)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}><Trash2 size={40} color='#f87171' /></div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', textAlign: 'center', marginBottom: '0.5rem' }}>Delete Policy?</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              This will remove the policy for <strong style={{ color: '#fff' }}>{TEMPLATE_LABEL[deleteTarget]?.label || deleteTarget}</strong>.
              Certificates of this type will fall back to default settings.
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn" onClick={confirmDelete}
                style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff' }}>
                Delete Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: highlight ? '#4ade80' : 'var(--text-dim)', fontWeight: highlight ? 600 : 400 }}>{value}</span>
    </div>
  )
}
