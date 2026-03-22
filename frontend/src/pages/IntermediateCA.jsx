import { useState } from 'react'
import { api } from '../api'

const TEMPLATES = ['tls_server', 'client_auth', 'email_signing', 'code_signing']
const DEFAULTS  = { name: '', email: '', template: 'tls_server', san: '', days: '365' }

export default function IntermediateCA() {
  const [form, setForm]         = useState(DEFAULTS)
  const [initResult, setInitResult] = useState('')
  const [initStatus, setInitStatus] = useState('')
  const [issueResult, setIssueResult] = useState('')
  const [issueStatus, setIssueStatus] = useState('')
  const [loading, setLoading]   = useState('')

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleInit() {
    setLoading('init'); setInitResult(''); setInitStatus('')
    try {
      const { data } = await api.caStatus()
      setInitResult(
        `Root CA Subject : ${data.subject}\n` +
        `Root CA Serial  : ${data.serial}\n` +
        `Root CA Expires : ${data.not_after}\n\n` +
        `✓  Intermediate CA will be initialised automatically on first issue.`
      )
      setInitStatus('success')
    } catch (e) {
      setInitResult(e.response?.data?.detail || e.message)
      setInitStatus('danger')
    } finally { setLoading('') }
  }

  async function handleIssue() {
    if (!form.name || !form.email) { setIssueResult('Name and Email are required.'); setIssueStatus('danger'); return }
    setLoading('issue'); setIssueResult(''); setIssueStatus('')
    try {
      const { data } = await api.issueCert({
        name: form.name, email: form.email,
        org: 'Example Corp', org_unit: 'Engineering',
        country: 'US', state: 'California', locality: 'San Francisco',
        days: parseInt(form.days) || 365,
        template: form.template,
        san_names: form.san ? form.san.split(',').map(s => s.trim()).filter(Boolean) : [],
        use_intermediate: true,
      })
      setIssueResult(
        `Subject  : ${data.subject}\n` +
        `Serial   : ${data.serial}\n` +
        `Issued By: ${data.issued_by}\n` +
        `Template : ${data.template}\n` +
        `Expires  : ${data.not_after}\n\n` +
        `✓  Certificate issued via Intermediate CA.`
      )
      setIssueStatus('success')
    } catch (e) {
      setIssueResult(e.response?.data?.detail || e.message)
      setIssueStatus('danger')
    } finally { setLoading('') }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Intermediate Certificate Authority</div>
        <div className="page-desc">Two-tier PKI hierarchy: Root CA → Intermediate CA → End-entity certificate.</div>
      </div>

      <div className="card">
        <div className="card-title"><span className="card-title-icon">🔗</span>PKI Hierarchy</div>
        <div className="card-divider" />
        <div className="info-box">
          <span className="info-box-icon">🏛️</span>
          The Root CA stays offline. The Intermediate CA handles day-to-day issuance.
          If the Intermediate is compromised, the Root can revoke it without replacing the trust anchor.
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn btn-accent" onClick={handleInit} disabled={!!loading}>
            {loading === 'init' ? <><span className="btn-spinner" /> Checking…</> : '🔗  Init Intermediate CA'}
          </button>
        </div>
        {initResult && <pre className={`result-box ${initStatus}`}>{initResult}</pre>}
      </div>

      <div className="card">
        <div className="card-title"><span className="card-title-icon">📜</span>Issue via Intermediate CA</div>
        <div className="card-divider" />
        <div className="form-grid">
          {[['Full Name *','name','text'],['Email *','email','email'],['Validity (days)','days','number'],['SAN (comma-separated)','san','text']].map(([l,k,t]) => (
            <div className="form-group" key={k}>
              <label>{l}</label>
              <input type={t} value={form[k]} onChange={set(k)} />
            </div>
          ))}
          <div className="form-group">
            <label>Template</label>
            <select value={form.template} onChange={set('template')}>
              {TEMPLATES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-success" onClick={handleIssue} disabled={!!loading}>
            {loading === 'issue' ? <><span className="btn-spinner" /> Issuing…</> : '📜  Issue via Intermediate'}
          </button>
        </div>
        {issueResult && <pre className={`result-box ${issueStatus}`}>{issueResult}</pre>}
      </div>
    </>
  )
}
