import { useEffect, useState } from 'react'
import { api } from '../api'
import { Mail, CheckCircle2, AlertTriangle, Send } from 'lucide-react'

export default function Settings() {
  const [form, setForm]       = useState({ enabled: false, api_key: '', from_email: '' })
  const [hasKey, setHasKey]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg]         = useState(null)

  useEffect(() => {
    api.getSmtp()
      .then(r => { setHasKey(r.data._has_api_key || false); setForm(r.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = (k) => (e) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      await api.saveSmtp(form)
      setHasKey(!!form.api_key || hasKey)
      setMsg({ type: 'success', text: 'Settings saved.' })
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Save failed.' })
    } finally { setSaving(false) }
  }

  const test = async () => {
    setTesting(true); setMsg(null)
    try {
      await api.testSmtp(form)
      setMsg({ type: 'success', text: `Test email sent to ${form.from_email}. Check your inbox.` })
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Test failed.' })
    } finally { setTesting(false) }
  }

  const canTest = form.from_email && (form.api_key || hasKey)

  return (
    <>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="page-desc">Configure email delivery so certificates are sent directly to users after approval.</div>
      </div>

      {loading ? <div className="spinner" /> : (
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={15} /> Email Delivery — SendGrid</div>
          <div className="card-divider" />

          <div style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '1.2rem', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
            When configured, approving a certificate request and clicking "Send to User" will email the .pem file directly to the employee.
            Uses <strong style={{color:'#a78bfa'}}>SendGrid</strong> — no SMTP ports, works on any network.
          </div>

          {/* Enable toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem', padding: '12px 16px', background: 'var(--panel2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <input type="checkbox" id="sg_enabled" checked={form.enabled} onChange={set('enabled')} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="sg_enabled" style={{ color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              Enable email delivery
            </label>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: form.enabled ? '#4ade80' : 'var(--text-muted)', fontWeight: 600 }}>
              {form.enabled ? 'ON' : 'OFF'}
            </span>
          </div>

          <div className="form-grid">
            <div className="form-group full">
              <label>
                SendGrid API Key
                {hasKey && <span style={{color:'#4ade80',fontWeight:400,marginLeft:6,fontSize:11}}>✓ saved — paste new key to replace</span>}
              </label>
              <input
                type="password"
                value={form.api_key}
                onChange={set('api_key')}
                placeholder={hasKey ? 'Leave blank to keep current key' : 'SG.xxxxxxxxxxxxxxxx'}
              />
            </div>
            <div className="form-group full">
              <label>From Address</label>
              <input type="email" value={form.from_email} onChange={set('from_email')} placeholder="noreply@yourdomain.com" />
            </div>
          </div>

          {/* SendGrid help */}
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '12px 16px', margin: '0.8rem 0 1.2rem', fontSize: '12px', color: '#fbbf24', lineHeight: 1.7 }}>
            <strong>Setup:</strong> Sign up free at <strong>sendgrid.com</strong> → Settings → API Keys → Create API Key (Full Access) → paste it above.
            Then verify your From Address under Sender Authentication. Free tier = 100 emails/day.
          </div>

          {msg && (
            <div style={{ background: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, borderRadius: '8px', padding: '10px 14px', color: msg.type === 'success' ? '#4ade80' : '#f87171', fontSize: '13px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
              {msg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {msg.text}
            </div>
          )}

          <div className="btn-row">
            <button className="btn" onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              {saving ? <><span className="btn-spinner" /> Saving…</> : <><CheckCircle2 size={14} />Save Settings</>}
            </button>
            <button className="btn btn-secondary" onClick={test} disabled={testing || !canTest} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              {testing ? <><span className="btn-spinner" /> Sending…</> : <><Send size={14} />Send Test Email</>}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
