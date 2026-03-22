import { useEffect, useState } from 'react'
import { api } from '../api'
import { Building2, Pencil, AlertTriangle, RotateCcw } from 'lucide-react'

const extract = (subject, key) => subject?.match(new RegExp(`${key}=([^,]+)`))?.[1] || ''

export default function InitCA() {
  const [ca, setCa]           = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [form, setForm]       = useState(null)
  const [certCount, setCertCount] = useState(0)

  useEffect(() => {
    Promise.all([api.initCA(), api.listCerts()])
      .then(([caRes, certsRes]) => {
        setCa(caRes.data)
        setCertCount(certsRes.data.filter(c => !c.revoked).length)
      })
      .catch(e => setError(e.response?.data?.detail || 'Backend unavailable.'))
      .finally(() => setLoading(false))
  }, [])

  const openEdit = () => {
    setForm({
      common_name:   extract(ca.subject, 'CN'),
      org:           extract(ca.subject, 'O'),
      org_unit:      extract(ca.subject, 'OU'),
      country:       extract(ca.subject, 'C'),
      state:         extract(ca.subject, 'ST'),
      locality:      extract(ca.subject, 'L'),
      validity_days: Math.round((new Date(ca.not_after) - new Date(ca.not_before)) / 86400000),
    })
    setSaveErr('')
    setEditing(true)
  }

  const handleSave = async () => {
    if (!form.common_name || !form.org || !form.country) { setSaveErr('Common Name, Organisation and Country are required.'); return }
    if (form.country.length !== 2) { setSaveErr('Country must be exactly 2 letters.'); return }
    setSaving(true); setSaveErr('')
    try {
      const { data } = await api.regenerateCA({ ...form, validity_days: parseInt(form.validity_days) || 3650 })
      setCa(data)
      setEditing(false)
    } catch (e) {
      setSaveErr(e.response?.data?.detail || 'Regeneration failed.')
    } finally {
      setSaving(false)
    }
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const daysLeft = ca ? Math.floor((new Date(ca.not_after) - new Date()) / 86400000) : null
  const healthy  = daysLeft !== null && daysLeft > 365

  return (
    <>
      <div className="page-header">
        <div className="page-title">CA Status</div>
        <div className="page-desc">Root Certificate Authority — trust anchor for all issued certificates.</div>
      </div>

      {loading && <div className="spinner" />}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '14px 18px', color: '#f87171', fontSize: '13px' }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {ca && !editing && (
        <>
          {/* Status bar */}
          <div style={{
            background: healthy ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${healthy ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
            borderRadius: '10px', padding: '14px 18px', marginBottom: '1.5rem',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: healthy ? '#4ade80' : '#fbbf24', boxShadow: `0 0 6px ${healthy ? '#4ade80' : '#fbbf24'}` }} />
            <span style={{ color: '#fff', fontWeight: 600, fontSize: '13px' }}>{healthy ? 'Operational' : 'Expiring Soon'}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>·</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{daysLeft} days remaining</span>
            <button className="btn btn-secondary btn-sm" onClick={openEdit} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}><Pencil size={13} /> Edit</button>
          </div>

          {/* Certificate details */}
          <div className="card">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Building2 size={15} /> Root CA Certificate</div>
            <div className="card-divider" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                ['Common Name',  extract(ca.subject, 'CN')],
                ['Organisation', extract(ca.subject, 'O')],
                ['Org Unit',     extract(ca.subject, 'OU')],
                ['Country',      extract(ca.subject, 'C')],
                ['State',        extract(ca.subject, 'ST')],
                ['Locality',     extract(ca.subject, 'L')],
                ['Type',         'Self-Signed Root CA'],
                ['Valid From',   ca.not_before?.slice(0, 10)],
                ['Valid Until',  ca.not_after?.slice(0, 10)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{k}</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{v || '—'}</span>
                </div>
              ))}
              <div style={{ paddingTop: '12px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Serial Number</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-dim)', background: '#080812', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px 12px', wordBreak: 'break-all' }}>
                  {ca.serial}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit form */}
      {editing && form && (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Pencil size={15} /> Edit CA Details</div>
          <div className="card-divider" />

          {/* Warning — only if certs already issued */}
          {certCount > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '12px 16px', marginBottom: '1.2rem', color: '#f87171', fontSize: '13px', lineHeight: 1.6 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {certCount} certificate{certCount > 1 ? 's have' : ' has'} already been issued. Regenerating the CA will invalidate them all.
            </div>
          )}

          <div className="form-grid">
            {[
              ['Common Name *',    'common_name', 'text'],
              ['Organisation *',   'org',         'text'],
              ['Org Unit',         'org_unit',    'text'],
              ['State / Province', 'state',       'text'],
              ['City / Locality',  'locality',    'text'],
              ['Validity (days)',  'validity_days','number'],
            ].map(([label, key, type]) => (
              <div className="form-group" key={key}>
                <label>{label}</label>
                <input type={type} value={form[key]} onChange={set(key)} />
              </div>
            ))}
            <div className="form-group">
              <label>Country (2-letter code) *</label>
              <input type="text" value={form.country} onChange={set('country')} maxLength={2} placeholder="US" style={{ textTransform: 'uppercase' }} />
            </div>
          </div>

          {saveErr && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '13px', margin: '0.8rem 0' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {saveErr}
            </div>
          )}

          <div className="btn-row" style={{ marginTop: '1rem' }}>
            <button className="btn" onClick={handleSave} disabled={saving}
              style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff' }}>
              {saving ? <><span className="btn-spinner" /> Regenerating…</> : <><RotateCcw size={14} style={{ marginRight: 6 }} />Regenerate CA</>}
            </button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          </div>
        </div>
      )}
    </>
  )
}
