import { useState } from 'react'
import { api } from '../api'

const TEMPLATES = ['client_auth', 'tls_server', 'email_signing', 'code_signing']

const DEFAULTS = {
  name: '', email: '', org: 'Example Corp', org_unit: 'Engineering',
  country: 'US', state: 'California', locality: 'San Francisco',
  days: '365', template: 'client_auth', san_names: '',
  use_intermediate: false,
}

export default function IssueCert() {
  const [form, setForm]     = useState(DEFAULTS)
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function handleIssue() {
    if (!form.name || !form.email) {
      setResult('Name and Email are required.')
      setStatus('danger')
      return
    }
    if (form.country.length !== 2) {
      setResult('Country must be exactly 2 letters (e.g. US, IN, GB).')
      setStatus('danger')
      return
    }
    setLoading(true)
    setResult('')
    setStatus('')
    try {
      const { data } = await api.issueCert({
        name: form.name, email: form.email, org: form.org,
        org_unit: form.org_unit, country: form.country,
        state: form.state, locality: form.locality,
        days: parseInt(form.days) || 365,
        template: form.template,
        san_names: form.san_names ? form.san_names.split(',').map(s => s.trim()).filter(Boolean) : [],
        use_intermediate: form.use_intermediate,
      })
      setResult(
        `Name        : ${form.name}\n` +
        `Email       : ${form.email}\n` +
        `Template    : ${data.template}\n` +
        `Issued By   : ${data.issued_by}\n` +
        `Serial      : ${data.serial}\n` +
        `Valid From  : ${data.not_before}\n` +
        `Valid Until : ${data.not_after}\n\n` +
        `Copy the serial number above to use in Verify / Revoke.\n\n` +
        `--- PEM CERTIFICATE ---\n${data.pem}`
      )
      setStatus('success')
    } catch (e) {
      setResult(e.response?.data?.detail || e.message)
      setStatus('danger')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Issue Certificate</div>
        <div className="page-desc">Generate a CSR and issue a signed X.509 v3 certificate for any identity.</div>
      </div>

      <div className="card">
        <div className="card-title"><span className="card-title-icon">👤</span>Subject Identity</div>
        <div className="card-divider" />
        <div className="form-grid">
          {[
            ['Full Name *',        'name',     'text'],
            ['Email Address *',    'email',    'email'],
            ['Organization',       'org',      'text'],
            ['Org Unit',           'org_unit', 'text'],
            ['State / Province',   'state',    'text'],
            ['City / Locality',    'locality', 'text'],
            ['Validity (days)',    'days',     'number'],
          ].map(([label, key, type]) => (
            <div className="form-group" key={key}>
              <label>{label}</label>
              <input type={type} value={form[key]} onChange={set(key)} />
            </div>
          ))}
          <div className="form-group">
            <label>Country (2-letter code)</label>
            <input type="text" value={form.country} onChange={set('country')} maxLength={2} placeholder="US" style={{ textTransform: 'uppercase' }} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><span className="card-title-icon">⚙️</span>Certificate Options</div>
        <div className="card-divider" />
        <div className="form-grid">
          <div className="form-group">
            <label>Template</label>
            <select value={form.template} onChange={set('template')}>
              {TEMPLATES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>SAN — Subject Alternative Names (TLS only)</label>
            <input type="text" value={form.san_names} onChange={set('san_names')}
              placeholder="example.com, www.example.com" />
          </div>
          <div className="form-group full">
            <div className="checkbox-row">
              <input type="checkbox" id="use_int" checked={form.use_intermediate} onChange={set('use_intermediate')} />
              <label htmlFor="use_int">Issue via Intermediate CA (Root → Intermediate → End-entity)</label>
            </div>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-success" onClick={handleIssue} disabled={loading}>
            {loading ? <><span className="btn-spinner" /> Issuing…</> : '📜  Issue Certificate'}
          </button>
        </div>
        {result && <pre className={`result-box ${status}`}>{result}</pre>}
      </div>
    </>
  )
}
